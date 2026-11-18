import { getTableColumns, getTableName } from "drizzle-orm";
import { getTableConfig, MySqlDialect } from "drizzle-orm/mysql-core";

export type ReviewTestMemory = {
  tables: Record<string, any[]>;
  writes: number;
  failAt: number;
};
const transactionQueues = new WeakMap<ReviewTestMemory, Promise<unknown>>();

/** Stateful storage adapter only: production functions own all review behavior.
 * Unsupported SQL fails loudly rather than silently matching every stored row. */
export function makeReviewTestDatabase(
  memory: ReviewTestMemory,
  tables = memory.tables
): any {
  const dialect = new MySqlDialect();
  type Row = Record<string, any>;
  const columnValue = (row: Row, table: string, field: string) =>
    row[table]?.[field];
  const match = (row: Row, condition: any): boolean => {
    if (!condition) return true;
    const { sql, params } = dialect.sqlToQuery(condition);
    const tokens =
      sql.match(
        /`[^`]+`\.`[^`]+`|\?|<>|!=|>=|<=|[=><()]|\b(?:and|or|in|is|not|null)\b|,/gi
      ) ?? [];
    let cursor = 0,
      parameter = 0;
    const operand = (): any => {
      const token = tokens[cursor++];
      if (token === "?") return params[parameter++];
      const column = token?.match(/^`([^`]+)`\.`([^`]+)`$/);
      if (column) return columnValue(row, column[1], column[2]);
      if (token?.toLowerCase() === "null") return null;
      throw new Error(`Unsupported test SQL operand: ${sql}`);
    };
    const atom = (): boolean => {
      if (tokens[cursor] === "(") {
        cursor++;
        const value = expression();
        if (tokens[cursor++] !== ")")
          throw new Error(`Unbalanced test SQL: ${sql}`);
        return value;
      }
      const left = operand();
      const operator = tokens[cursor++]?.toLowerCase();
      if (operator === "is") {
        const negate = tokens[cursor]?.toLowerCase() === "not";
        if (negate) cursor++;
        if (tokens[cursor++]?.toLowerCase() !== "null")
          throw new Error(`Unsupported test SQL: ${sql}`);
        return negate ? left != null : left == null;
      }
      if (operator === "in") {
        if (tokens[cursor++] !== "(")
          throw new Error(`Unsupported IN query: ${sql}`);
        const values = [operand()];
        while (tokens[cursor] === ",") {
          cursor++;
          values.push(operand());
        }
        if (tokens[cursor++] !== ")")
          throw new Error(`Unsupported IN query: ${sql}`);
        return left != null && values.includes(left);
      }
      const right = operand();
      if (left == null || right == null) return false;
      switch (operator) {
        case "=":
          return left === right;
        case "<>":
        case "!=":
          return left !== right;
        case ">":
          return left > right;
        case "<":
          return left < right;
        case ">=":
          return left >= right;
        case "<=":
          return left <= right;
        default:
          throw new Error(`Unsupported test SQL comparison: ${sql}`);
      }
    };
    const conjunction = (): boolean => {
      let value = atom();
      while (tokens[cursor]?.toLowerCase() === "and") {
        cursor++;
        const next = atom();
        value = value && next;
      }
      return value;
    };
    const expression = (): boolean => {
      let value = conjunction();
      while (tokens[cursor]?.toLowerCase() === "or") {
        cursor++;
        const next = conjunction();
        value = value || next;
      }
      return value;
    };
    const result = expression();
    if (cursor !== tokens.length || parameter !== params.length)
      throw new Error(`Unsupported test SQL condition: ${sql}`);
    return result;
  };
  const valueOf = (row: Row, value: any): any => {
    if (value?.table && value?.name)
      return columnValue(row, getTableName(value.table), value.name);
    const query = dialect.sqlToQuery(value).sql;
    const column = query.match(/`([^`]+)`\.`([^`]+)`/);
    if (!column)
      throw new Error(`Unsupported test SQL projection/order: ${query}`);
    return columnValue(row, column[1], column[2]);
  };
  const write = () => {
    memory.writes++;
    if (memory.failAt && memory.writes === memory.failAt)
      throw new Error("Injected database failure");
  };
  const db: any = {
    select(projection?: Record<string, any>) {
      let table = "",
        condition: any,
        maximum = Infinity,
        ordering: any[] = [];
      const joins: Array<{ table: string; condition: any; left: boolean }> = [];
      const builder: any = {
        from(value: any) {
          table = getTableName(value);
          return builder;
        },
        where(value: any) {
          condition = value;
          return builder;
        },
        limit(value: number) {
          maximum = value;
          return builder;
        },
        orderBy(...values: any[]) {
          ordering = values;
          return builder;
        },
        for() {
          return builder;
        },
        innerJoin(value: any, on: any) {
          joins.push({
            table: getTableName(value),
            condition: on,
            left: false,
          });
          return builder;
        },
        leftJoin(value: any, on: any) {
          joins.push({ table: getTableName(value), condition: on, left: true });
          return builder;
        },
        then(resolve: any, reject: any) {
          return Promise.resolve()
            .then(() => {
              let rows: Row[] = (tables[table] ?? []).map(row => ({
                [table]: row,
              }));
              for (const join of joins)
                rows = rows.flatMap(row => {
                  const matches = (tables[join.table] ?? [])
                    .map(next => ({ ...row, [join.table]: next }))
                    .filter(next => match(next, join.condition));
                  return matches.length || !join.left
                    ? matches
                    : [{ ...row, [join.table]: null }];
                });
              rows = rows.filter(row => match(row, condition));
              const aggregates =
                projection &&
                Object.values(projection).some(
                  value =>
                    !value?.table &&
                    /^max\(/i.test(dialect.sqlToQuery(value).sql)
                );
              if (aggregates)
                return [
                  Object.fromEntries(
                    Object.entries(projection!).map(([key, value]) => {
                      const values = rows
                        .map(row => valueOf(row, value))
                        .filter(next => next != null);
                      return [key, values.length ? Math.max(...values) : null];
                    })
                  ),
                ];
              rows.sort((a, b) => {
                for (const order of ordering) {
                  const left = valueOf(a, order),
                    right = valueOf(b, order);
                  if (
                    left === right ||
                    (left instanceof Date &&
                      right instanceof Date &&
                      +left === +right)
                  )
                    continue;
                  const query = order?.table
                    ? ""
                    : dialect.sqlToQuery(order).sql;
                  return (
                    (left > right ? 1 : -1) * (/desc/i.test(query) ? -1 : 1)
                  );
                }
                return 0;
              });
              return structuredClone(
                rows
                  .slice(0, maximum)
                  .map(row =>
                    projection
                      ? Object.fromEntries(
                          Object.entries(projection).map(([key, value]) => [
                            key,
                            valueOf(row, value),
                          ])
                        )
                      : joins.length
                        ? row
                        : row[table]
                  )
              );
            })
            .then(resolve, reject);
        },
      };
      return builder;
    },
    insert(value: any) {
      const table = getTableName(value),
        config = getTableConfig(value),
        columns = getTableColumns(value);
      const keysByColumn = new Map(
        Object.entries(columns).map(([key, column]: [string, any]) => [
          column.name,
          key,
        ])
      );
      const unique = [
        ...config.columns
          .filter(column => column.primary || column.isUnique)
          .map(column => [keysByColumn.get(column.name)!]),
        ...config.indexes
          .filter(index => index.config.unique)
          .map(index =>
            index.config.columns.map(
              (column: any) => keysByColumn.get(column.name)!
            )
          ),
      ];
      let inputs: any[] = [],
        ignore = false,
        duplicateUpdate: any;
      const builder: any = {
        ignore() {
          ignore = true;
          return builder;
        },
        values(next: any) {
          inputs = Array.isArray(next) ? next : [next];
          return builder;
        },
        onDuplicateKeyUpdate(next: any) {
          duplicateUpdate = next.set;
          return builder;
        },
        then(resolve: any, reject: any) {
          return Promise.resolve()
            .then(() => {
              write();
              const rows = structuredClone(tables[table] ?? []);
              let affectedRows = 0,
                insertId = 0;
              for (const input of inputs) {
                const row = { ...input };
                for (const [key, column] of Object.entries(columns) as Array<
                  [string, any]
                >) {
                  if (row[key] !== undefined) continue;
                  if (column.autoIncrement)
                    row[key] =
                      Math.max(
                        0,
                        ...rows.map((item: any) => Number(item[key]) || 0)
                      ) + 1;
                  else if (column.default !== undefined)
                    row[key] = column.default?.queryChunks
                      ? new Date()
                      : structuredClone(column.default);
                  else if (!column.notNull) row[key] = null;
                }
                const old = rows.find((existing: any) =>
                  unique.some(keys =>
                    keys.every(
                      key => row[key] != null && existing[key] === row[key]
                    )
                  )
                );
                if (old) {
                  if (duplicateUpdate) {
                    Object.assign(old, duplicateUpdate);
                    affectedRows += 2;
                    continue;
                  }
                  if (ignore) continue;
                  throw new Error(`Duplicate key in ${table}`);
                }
                for (const [key, column] of Object.entries(columns) as Array<
                  [string, any]
                >) {
                  if (column.notNull && row[key] == null)
                    throw new Error(`Missing required ${table}.${key}`);
                }
                rows.push(row);
                affectedRows++;
                const auto = Object.entries(columns).find(
                  ([, column]: any) => column.autoIncrement
                )?.[0];
                if (!insertId && auto) insertId = row[auto];
              }
              tables[table] = rows;
              return [{ affectedRows, insertId }];
            })
            .then(resolve, reject);
        },
      };
      return builder;
    },
    update(value: any) {
      const table = getTableName(value);
      let values: any, condition: any;
      const builder: any = {
        set(next: any) {
          values = next;
          return builder;
        },
        where(next: any) {
          condition = next;
          return builder;
        },
        then(resolve: any, reject: any) {
          return Promise.resolve()
            .then(() => {
              write();
              let affectedRows = 0;
              for (const row of tables[table] ?? []) {
                if (match({ [table]: row }, condition)) {
                  Object.assign(row, values);
                  affectedRows++;
                }
              }
              return [{ affectedRows }];
            })
            .then(resolve, reject);
        },
      };
      return builder;
    },
    transaction(operation: any) {
      const perform = async () => {
        const snapshot = structuredClone(tables);
        const result = await operation(
          makeReviewTestDatabase(memory, snapshot)
        );
        // Rows, generated IDs and journal entries become visible together, only
        // after every awaited write succeeds. Exceptions discard the snapshot.
        for (const key of Object.keys(tables)) delete tables[key];
        Object.assign(tables, snapshot);
        return result;
      };
      if (tables !== memory.tables) return perform();
      const result = (transactionQueues.get(memory) ?? Promise.resolve()).then(
        perform
      );
      transactionQueues.set(
        memory,
        result.catch(() => undefined)
      );
      return result;
    },
  };
  return db;
}

export const reviewTestSong = (
  id: number,
  type = "youtube",
  priority = false
) => ({
  id,
  status: "pending",
  position: id,
  artistName: `Artist ${id}`,
  songTitle: `Song ${id}`,
  submissionType: type,
  youtubeUrl: type === "youtube" ? `https://youtu.be/video${id}` : null,
  fileUrl: type === "file" ? `/manus-storage/song${id}.mp3` : null,
  skipPaymentConfirmed: priority,
  fireCount: 3,
  trashCount: 1,
  createdAt: new Date(id * 1000),
});

export function resetReviewTestMemory(memory: ReviewTestMemory) {
  for (const key of Object.keys(memory.tables)) delete memory.tables[key];
  Object.assign(memory.tables, {
    queue_state: [
      {
        id: 1,
        currentPlayingId: null,
        isLive: true,
        livePlaybackState: "stopped",
        livePlaybackRevision: 0,
        livePlaybackPositionMs: 0,
        livePlaybackStartedAt: null,
      },
    ],
    review_submissions: [
      reviewTestSong(1),
      reviewTestSong(2, "file"),
      reviewTestSong(3),
    ],
    song_reactions: [],
    users: [],
    review_occurrences: [],
    review_occurrence_votes: [],
    review_live_events: [],
    review_tiktok_deliveries: [],
    review_gift_streaks: [],
    site_settings: [],
  });
  memory.writes = 0;
  memory.failAt = 0;
}
