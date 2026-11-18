import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { readFileSync } from "node:fs";
import { describe, expect, it, beforeEach, vi } from "vitest";

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: toastError } }));

import { FireTrashPoll } from "../client/src/components/ReviewFireTrashPoll";

const baseProps = {
  submissionId: 7,
  songTitle: "Track",
  artistName: "Artist",
  fireCount: 10,
  trashCount: 3,
  myReaction: null as string | null,
  onVote: vi.fn(),
  isPending: false,
  user: { id: 1, role: "user" },
  isJudge: false,
};

function render(overrides: Partial<typeof baseProps> = {}) {
  const props = { ...baseProps, ...overrides, onVote: overrides.onVote ?? vi.fn() };
  let tree!: ReactTestRenderer;
  act(() => { tree = create(React.createElement(FireTrashPoll, props)); });
  return { tree, props };
}

function buttons(tree: ReactTestRenderer) {
  const all = tree.root.findAll(node => typeof node.props?.onClick === "function");
  return { fire: all[0]!, trash: all[1]! };
}

describe("repeat admin Fire/Trash review voting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).React = React;
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it("forwards five Fire and three Trash rapid admin clicks, one callback per click", () => {
    const onVote = vi.fn();
    const { tree } = render({ user: { id: 1, role: "admin" }, onVote });
    const { fire, trash } = buttons(tree);
    act(() => {
      for (let index = 0; index < 5; index++) fire.props.onClick();
      for (let index = 0; index < 3; index++) trash.props.onClick();
    });
    expect(onVote.mock.calls.map(([reaction]) => reaction)).toEqual(["fire", "fire", "fire", "fire", "fire", "trash", "trash", "trash"]);
    expect(fire.props.disabled).toBe(false);
    expect(trash.props.disabled).toBe(false);
    expect(tree.root.findAll(node => node.children.join("").includes("Admin · +1 per tap"))).toHaveLength(1);
  });

  it("keeps both admin choices enabled after an existing choice while pending", () => {
    const { tree } = render({ user: { id: 1, role: "admin" }, myReaction: "fire", isPending: true });
    const { fire, trash } = buttons(tree);
    expect(fire.props.disabled).toBe(false);
    expect(trash.props.disabled).toBe(false);
  });

  it("preserves normal user and judge choice/pending guards", () => {
    for (const user of [{ id: 1, role: "user" }, { id: 2, role: "judge" }]) {
      const same = render({ user, myReaction: "fire", isPending: false });
      expect(buttons(same.tree).fire.props.disabled).toBe(true);
      expect(buttons(same.tree).trash.props.disabled).toBe(false);
      const pending = render({ user, myReaction: "fire", isPending: true });
      expect(buttons(pending.tree).fire.props.disabled).toBe(true);
      expect(buttons(pending.tree).trash.props.disabled).toBe(true);
    }
  });

  it("guards guests without invoking the callback", () => {
    const onVote = vi.fn();
    const { tree } = render({ user: null, onVote });
    act(() => buttons(tree).fire.props.onClick());
    expect(onVote).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("Login to vote");
  });

  it("keeps the page admin branch occurrence-bound and separate from normal react voting", () => {
    const source = readFileSync(new URL("../client/src/pages/MusicReview.tsx", import.meta.url), "utf8");
    const pollStart = source.indexOf("<FireTrashPoll");
    const pollBlock = source.slice(pollStart, source.indexOf("/>", pollStart) + 2);
    expect(source).toMatch(/adminTapMutation\s*=\s*trpc\.reviewStudio\.addVotes\.useMutation/);
    expect(pollBlock).toMatch(/user\.role\s*===\s*["']admin["']/);
    expect(pollBlock).toMatch(/amount\s*:\s*1/);
    expect(pollBlock).toMatch(/requestId\s*:\s*crypto\.randomUUID\(\)/);
    expect(pollBlock).toMatch(/reaction/);
    expect(pollBlock).toMatch(/reactMutation\.mutate/);
    expect(pollBlock).not.toMatch(/user\.role\s*===\s*["']judge["'][\s\S]*adminTapMutation/);
    expect(pollBlock).not.toMatch(/reactMutation\.isPending\s*&&/);
  });
});
