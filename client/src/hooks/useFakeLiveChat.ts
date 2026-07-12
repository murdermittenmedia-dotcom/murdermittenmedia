import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import type { FakeChatMessageData, ChatControlsData, AdminControlSyncData } from "./useChat";

export interface FakeChatMessage {
  id: string;
  username: string;
  text: string;
  timestamp: number;
  role: "user" | "admin" | "judge";
  userId: number;
}

// 1000 unique comment variations
const COMMENT_VARIANTS: string[] = [
  // ── FIRE / POSITIVE (lowercase) ──────────────────────────────
  "this hard","fire","bars","heat","slaps","goes hard","banger","this go crazy",
  "i fw this","lowkey fire","this different","ok ok ok","not bad","this clean",
  "vibing","feel that","locked in","bumping","this hitting","smooth","dope","sick",
  "tight","fresh","nice","who is this","track id?","drop it","need this","send link",
  "this hard fr","no cap this fire","bro really went off","ok i fw this",
  "this the one","this it right here","yeah yeah yeah","ok i see you",
  "not skipping this one","this a vibe","head nodding rn","this clean clean",
  "production crazy","mixing on point","flow nasty","hook sticky","verse hard",
  "beat insane","sample choice crazy","collab fire","energy different",
  "this real music","they not ready","slept on fr","this slaps hard",
  "cant skip this","this hits different","on repeat","need this on repeat",
  "this the vibe fr","lowkey banger","underrated af","this go off",
  "production on point","this clean af","bars on bars","flow crazy",
  "hook too hard","this different fr","energy crazy","this it","bro cooked",
  "they cooked fr","this hard no cap","this a hit","this gonna blow",
  "this the one fr","this hard asf","this fire fr","this slaps fr",
  "this go hard fr","this clean fr","this dope fr","this sick fr",
  "this tight fr","this fresh fr","this nice fr","this smooth fr",
  "this bumping fr","this vibing fr","this locked in fr","this hitting fr",
  "this banger fr","this heat fr","this bars fr","this fire no cap",
  "this hard on god","this slaps on god","this banger on god","this heat on god",
  "this real","this it right here fr","this the one on god","this go crazy fr",
  "this different on god","this clean on god","this dope on god","this sick on god",
  "this fire asf","this hard asf no cap","this slaps asf","this banger asf",
  "this heat asf","this bars asf","this clean asf","this dope asf",
  "this sick asf","this tight asf","this fresh asf","this nice asf",
  "this smooth asf","this bumping asf","this vibing asf","this locked in asf",
  "this hitting asf","this go hard asf","this go crazy asf","this different asf",
  "this real asf","this it asf","bro went crazy","they went crazy",
  "bro snapped","they snapped","bro bodied this","they bodied this",
  "bro cooked on this one","they cooked on this one","bro went off",
  "they went off","bro killed it","they killed it","bro ate","they ate",
  "bro ate and left no crumbs","they ate and left no crumbs",
  "no crumbs left","not a crumb in sight","bro said let me cook",
  "they said let me cook","bro said hold on","they said hold on",
  "bro said watch this","they said watch this","bro said im different",
  "they said im different","bro said im built different","they said im built different",
  "built different fr","built different no cap","built different on god",
  "this built different","this built different fr","this built different no cap",
  "this built different on god","this built different asf",
  "this a certified banger","this a certified hit","this a certified slapper",
  "this a certified bop","this a certified jam","this a certified vibe",
  "this a certified banger fr","this a certified hit fr","this a certified slapper fr",
  "this a certified bop fr","this a certified jam fr","this a certified vibe fr",
  "certified banger","certified hit","certified slapper","certified bop",
  "certified jam","certified vibe","certified banger fr","certified hit fr",
  "certified slapper fr","certified bop fr","certified jam fr","certified vibe fr",
  "this hard i cant lie","this fire i cant lie","this slaps i cant lie",
  "this banger i cant lie","this heat i cant lie","this bars i cant lie",
  "this clean i cant lie","this dope i cant lie","this sick i cant lie",
  "this tight i cant lie","this fresh i cant lie","this nice i cant lie",
  "i cant lie this hard","i cant lie this fire","i cant lie this slaps",
  "i cant lie this banger","i cant lie this heat","i cant lie this bars",
  "i cant lie this clean","i cant lie this dope","i cant lie this sick",
  "i cant lie this tight","i cant lie this fresh","i cant lie this nice",
  "not gonna lie this hard","not gonna lie this fire","not gonna lie this slaps",
  "not gonna lie this banger","not gonna lie this heat","not gonna lie this bars",
  "not gonna lie this clean","not gonna lie this dope","not gonna lie this sick",
  "ngl this hard","ngl this fire","ngl this slaps","ngl this banger",
  "ngl this heat","ngl this bars","ngl this clean","ngl this dope","ngl this sick",
  "ngl this tight","ngl this fresh","ngl this nice","ngl this smooth",
  "ngl this bumping","ngl this vibing","ngl this locked in","ngl this hitting",
  "ngl this go hard","ngl this go crazy","ngl this different","ngl this real",
  "ngl this it","ngl bro cooked","ngl they cooked","ngl bro snapped",
  "ngl they snapped","ngl bro bodied this","ngl they bodied this",
  "this hard ngl","this fire ngl","this slaps ngl","this banger ngl",
  "this heat ngl","this bars ngl","this clean ngl","this dope ngl","this sick ngl",
  "this tight ngl","this fresh ngl","this nice ngl","this smooth ngl",
  "this bumping ngl","this vibing ngl","this locked in ngl","this hitting ngl",
  "this go hard ngl","this go crazy ngl","this different ngl","this real ngl",
  "this it ngl","bro cooked ngl","they cooked ngl","bro snapped ngl",
  "they snapped ngl","bro bodied this ngl","they bodied this ngl",
  "this is hard","this is fire","this is slaps","this is a banger",
  "this is heat","this is bars","this is clean","this is dope","this is sick",
  "this is tight","this is fresh","this is nice","this is smooth",
  "this is bumping","this is a vibe","this is locked in","this is hitting",
  "this goes hard","this goes crazy","this is different","this is real",
  "this is it","bro cooked on this","they cooked on this","bro snapped on this",
  "they snapped on this","bro bodied this one","they bodied this one",
  "this is hard fr","this is fire fr","this is a banger fr","this is heat fr",
  "this is bars fr","this is clean fr","this is dope fr","this is sick fr",
  "this is tight fr","this is fresh fr","this is nice fr","this is smooth fr",
  "this is bumping fr","this is a vibe fr","this is locked in fr",
  "this is hitting fr","this goes hard fr","this goes crazy fr",
  "this is different fr","this is real fr","this is it fr",

  // ── FIRE / POSITIVE (Mixed Case) ─────────────────────────────
  "Bars fr","Fire track","This hard","Go off","Heat 🔥","Slaps hard",
  "Ok ok this hard","Not bad at all","This clean","Feel that",
  "Locked in rn","This hitting different","Smooth af","Dope track",
  "Sick beat","Fresh sound","Nice flow","Who is this?","Track ID?",
  "Drop it already","Need this on Spotify","Send the link",
  "This the one fr","Yeah this hard","Ok I fw this","This a vibe fr",
  "Head nodding","This clean clean","Production crazy",
  "Flow nasty fr","Hook too sticky","Verse hard","Beat insane",
  "This hard no cap","This fire no cap","This slaps no cap","This banger no cap",
  "This heat no cap","This bars no cap","This clean no cap","This dope no cap",
  "This sick no cap","This tight no cap","This fresh no cap","This nice no cap",
  "This smooth no cap","This bumping no cap","This a vibe no cap",
  "This locked in no cap","This hitting no cap","This go hard no cap",
  "This go crazy no cap","This different no cap","This real no cap","This it no cap",
  "Bro cooked no cap","They cooked no cap","Bro snapped no cap","They snapped no cap",
  "Bro bodied this no cap","They bodied this no cap","Bro went off no cap",
  "They went off no cap","Bro killed it no cap","They killed it no cap",
  "Bro ate no cap","They ate no cap","No crumbs left no cap",
  "Not a crumb in sight no cap","Built different no cap","Certified banger no cap",
  "Certified hit no cap","Certified slapper no cap","Certified bop no cap",
  "Certified jam no cap","Certified vibe no cap","This hard on god",
  "This fire on god","This slaps on god","This banger on god","This heat on god",
  "This bars on god","This clean on god","This dope on god","This sick on god",
  "This tight on god","This fresh on god","This nice on god","This smooth on god",
  "This bumping on god","This a vibe on god","This locked in on god",
  "This hitting on god","This go hard on god","This go crazy on god",
  "This different on god","This real on god","This it on god",
  "Bro cooked on god","They cooked on god","Bro snapped on god","They snapped on god",
  "Bro bodied this on god","They bodied this on god","Bro went off on god",
  "They went off on god","Bro killed it on god","They killed it on god",
  "Bro ate on god","They ate on god","No crumbs left on god",
  "Not a crumb in sight on god","Built different on god","Certified banger on god",
  "Certified hit on god","Certified slapper on god","Certified bop on god",
  "Certified jam on god","Certified vibe on god",
  "This hard asf","This fire asf","This slaps asf","This banger asf",
  "This heat asf","This bars asf","This clean asf","This dope asf",
  "This sick asf","This tight asf","This fresh asf","This nice asf",
  "This smooth asf","This bumping asf","This a vibe asf","This locked in asf",
  "This hitting asf","This go hard asf","This go crazy asf","This different asf",
  "This real asf","This it asf","Bro cooked asf","They cooked asf",
  "Bro snapped asf","They snapped asf","Bro bodied this asf","They bodied this asf",
  "Bro went off asf","They went off asf","Bro killed it asf","They killed it asf",
  "Bro ate asf","They ate asf","No crumbs left asf","Not a crumb in sight asf",
  "Built different asf","Certified banger asf","Certified hit asf",
  "Certified slapper asf","Certified bop asf","Certified jam asf","Certified vibe asf",
  "Ngl this hard","Ngl this fire","Ngl this slaps","Ngl this banger",
  "Ngl this heat","Ngl this bars","Ngl this clean","Ngl this dope","Ngl this sick",
  "Ngl this tight","Ngl this fresh","Ngl this nice","Ngl this smooth",
  "Ngl this bumping","Ngl this a vibe","Ngl this locked in","Ngl this hitting",
  "Ngl this go hard","Ngl this go crazy","Ngl this different","Ngl this real",
  "Ngl this it","Ngl bro cooked","Ngl they cooked","Ngl bro snapped",
  "Ngl they snapped","Ngl bro bodied this","Ngl they bodied this",
  "I fw this heavy","I fw this hard","I fw this fr","I fw this no cap",
  "I fw this on god","I fw this asf","I fw this ngl","I fw this lowkey",
  "Lowkey fw this","Lowkey this hard","Lowkey this fire","Lowkey this slaps",
  "Lowkey this banger","Lowkey this heat","Lowkey this bars","Lowkey this clean",
  "Lowkey this dope","Lowkey this sick","Lowkey this tight","Lowkey this fresh",
  "Lowkey this nice","Lowkey this smooth","Lowkey this bumping","Lowkey this a vibe",
  "Lowkey this locked in","Lowkey this hitting","Lowkey this go hard",
  "Lowkey this go crazy","Lowkey this different","Lowkey this real","Lowkey this it",
  "Lowkey bro cooked","Lowkey they cooked","Lowkey bro snapped","Lowkey they snapped",
  "Lowkey bro bodied this","Lowkey they bodied this","Lowkey bro went off",
  "Lowkey they went off","Lowkey bro killed it","Lowkey they killed it",
  "Lowkey bro ate","Lowkey they ate","Lowkey no crumbs left",
  "Lowkey not a crumb in sight","Lowkey built different","Lowkey certified banger",
  "Lowkey certified hit","Lowkey certified slapper","Lowkey certified bop",
  "Lowkey certified jam","Lowkey certified vibe",

  // ── FIRE / POSITIVE (UPPERCASE) ──────────────────────────────
  "FIRE","BARS","HEAT","THIS HARD","GO OFF","SLAPS","BANGER","GOES HARD",
  "FLAMES","CRAZY","INSANE","CERTIFIED BANGER","ABSOLUTE HEAT",
  "PRODUCTION CRAZY","FLOW NASTY","HOOK STICKY","VERSE HARD",
  "THIS FIRE","THIS SLAPS","THIS BANGER","THIS HEAT","THIS BARS","THIS CLEAN",
  "THIS DOPE","THIS SICK","THIS TIGHT","THIS FRESH","THIS NICE","THIS SMOOTH",
  "THIS BUMPING","THIS A VIBE","THIS LOCKED IN","THIS HITTING","THIS GO HARD",
  "THIS GO CRAZY","THIS DIFFERENT","THIS REAL","THIS IT","BRO COOKED",
  "THEY COOKED","BRO SNAPPED","THEY SNAPPED","BRO BODIED THIS","THEY BODIED THIS",
  "BRO WENT OFF","THEY WENT OFF","BRO KILLED IT","THEY KILLED IT","BRO ATE",
  "THEY ATE","NO CRUMBS LEFT","NOT A CRUMB IN SIGHT","BUILT DIFFERENT",
  "CERTIFIED HIT","CERTIFIED SLAPPER","CERTIFIED BOP","CERTIFIED JAM",
  "CERTIFIED VIBE","THIS HARD NO CAP","THIS FIRE NO CAP","THIS SLAPS NO CAP",
  "THIS BANGER NO CAP","THIS HEAT NO CAP","THIS BARS NO CAP","THIS CLEAN NO CAP",
  "THIS DOPE NO CAP","THIS SICK NO CAP","THIS TIGHT NO CAP","THIS FRESH NO CAP",
  "THIS NICE NO CAP","THIS SMOOTH NO CAP","THIS BUMPING NO CAP","THIS A VIBE NO CAP",
  "THIS LOCKED IN NO CAP","THIS HITTING NO CAP","THIS GO HARD NO CAP",
  "THIS GO CRAZY NO CAP","THIS DIFFERENT NO CAP","THIS REAL NO CAP","THIS IT NO CAP",
  "BRO COOKED NO CAP","THEY COOKED NO CAP","BRO SNAPPED NO CAP","THEY SNAPPED NO CAP",
  "BRO BODIED THIS NO CAP","THEY BODIED THIS NO CAP","BRO WENT OFF NO CAP",
  "THEY WENT OFF NO CAP","BRO KILLED IT NO CAP","THEY KILLED IT NO CAP",
  "BRO ATE NO CAP","THEY ATE NO CAP","NO CRUMBS LEFT NO CAP",
  "NOT A CRUMB IN SIGHT NO CAP","BUILT DIFFERENT NO CAP","CERTIFIED BANGER NO CAP",
  "CERTIFIED HIT NO CAP","CERTIFIED SLAPPER NO CAP","CERTIFIED BOP NO CAP",
  "CERTIFIED JAM NO CAP","CERTIFIED VIBE NO CAP","THIS HARD ON GOD",
  "THIS FIRE ON GOD","THIS SLAPS ON GOD","THIS BANGER ON GOD","THIS HEAT ON GOD",
  "THIS BARS ON GOD","THIS CLEAN ON GOD","THIS DOPE ON GOD","THIS SICK ON GOD",
  "THIS TIGHT ON GOD","THIS FRESH ON GOD","THIS NICE ON GOD","THIS SMOOTH ON GOD",
  "THIS BUMPING ON GOD","THIS A VIBE ON GOD","THIS LOCKED IN ON GOD",
  "THIS HITTING ON GOD","THIS GO HARD ON GOD","THIS GO CRAZY ON GOD",
  "THIS DIFFERENT ON GOD","THIS REAL ON GOD","THIS IT ON GOD",
  "BRO COOKED ON GOD","THEY COOKED ON GOD","BRO SNAPPED ON GOD","THEY SNAPPED ON GOD",
  "BRO BODIED THIS ON GOD","THEY BODIED THIS ON GOD","BRO WENT OFF ON GOD",
  "THEY WENT OFF ON GOD","BRO KILLED IT ON GOD","THEY KILLED IT ON GOD",
  "BRO ATE ON GOD","THEY ATE ON GOD","NO CRUMBS LEFT ON GOD",
  "NOT A CRUMB IN SIGHT ON GOD","BUILT DIFFERENT ON GOD","CERTIFIED BANGER ON GOD",
  "CERTIFIED HIT ON GOD","CERTIFIED SLAPPER ON GOD","CERTIFIED BOP ON GOD",
  "CERTIFIED JAM ON GOD","CERTIFIED VIBE ON GOD",
  "NGL THIS HARD","NGL THIS FIRE","NGL THIS SLAPS","NGL THIS BANGER",
  "NGL THIS HEAT","NGL THIS BARS","NGL THIS CLEAN","NGL THIS DOPE","NGL THIS SICK",
  "NGL THIS TIGHT","NGL THIS FRESH","NGL THIS NICE","NGL THIS SMOOTH",
  "NGL THIS BUMPING","NGL THIS A VIBE","NGL THIS LOCKED IN","NGL THIS HITTING",
  "NGL THIS GO HARD","NGL THIS GO CRAZY","NGL THIS DIFFERENT","NGL THIS REAL",
  "NGL THIS IT","NGL BRO COOKED","NGL THEY COOKED","NGL BRO SNAPPED",
  "NGL THEY SNAPPED","NGL BRO BODIED THIS","NGL THEY BODIED THIS",
  "I FW THIS HEAVY","I FW THIS HARD","I FW THIS FR","I FW THIS NO CAP",
  "I FW THIS ON GOD","I FW THIS ASF","I FW THIS NGL","I FW THIS LOWKEY",
  "LOWKEY FW THIS","LOWKEY THIS HARD","LOWKEY THIS FIRE","LOWKEY THIS SLAPS",
  "LOWKEY THIS BANGER","LOWKEY THIS HEAT","LOWKEY THIS BARS","LOWKEY THIS CLEAN",
  "LOWKEY THIS DOPE","LOWKEY THIS SICK","LOWKEY THIS TIGHT","LOWKEY THIS FRESH",
  "LOWKEY THIS NICE","LOWKEY THIS SMOOTH","LOWKEY THIS BUMPING","LOWKEY THIS A VIBE",
  "LOWKEY THIS LOCKED IN","LOWKEY THIS HITTING","LOWKEY THIS GO HARD",
  "LOWKEY THIS GO CRAZY","LOWKEY THIS DIFFERENT","LOWKEY THIS REAL","LOWKEY THIS IT",
  "LOWKEY BRO COOKED","LOWKEY THEY COOKED","LOWKEY BRO SNAPPED","LOWKEY THEY SNAPPED",
  "LOWKEY BRO BODIED THIS","LOWKEY THEY BODIED THIS","LOWKEY BRO WENT OFF",
  "LOWKEY THEY WENT OFF","LOWKEY BRO KILLED IT","LOWKEY THEY KILLED IT",
  "LOWKEY BRO ATE","LOWKEY THEY ATE","LOWKEY NO CRUMBS LEFT",
  "LOWKEY NOT A CRUMB IN SIGHT","LOWKEY BUILT DIFFERENT","LOWKEY CERTIFIED BANGER",
  "LOWKEY CERTIFIED HIT","LOWKEY CERTIFIED SLAPPER","LOWKEY CERTIFIED BOP",
  "LOWKEY CERTIFIED JAM","LOWKEY CERTIFIED VIBE",

  // ── TRASH / NEGATIVE (lowercase) ─────────────────────────────
  "trash","weak","mid","skip","next","nah","nope","not it","pass","hard pass",
  "garbage","corny","lame","boring","yawn","delete this","not feeling it",
  "this not it","nah bro","skip skip skip","mid at best","production weak",
  "flow off","hook not catching","beat selection off","mixing bad","this not ready",
  "this trash","this weak","this mid","this garbage","this corny","this lame",
  "this boring","this not it fr","this not it no cap","this not it on god",
  "this not it asf","this not it ngl","this mid fr","this mid no cap",
  "this mid on god","this mid asf","this mid ngl","this weak fr","this weak no cap",
  "this weak on god","this weak asf","this weak ngl","this trash fr","this trash no cap",
  "this trash on god","this trash asf","this trash ngl","this garbage fr",
  "this garbage no cap","this garbage on god","this garbage asf","this garbage ngl",
  "this corny fr","this corny no cap","this corny on god","this corny asf",
  "this corny ngl","this lame fr","this lame no cap","this lame on god",
  "this lame asf","this lame ngl","this boring fr","this boring no cap",
  "this boring on god","this boring asf","this boring ngl","nah this trash",
  "nah this weak","nah this mid","nah this garbage","nah this corny","nah this lame",
  "nah this boring","nah this not it","nah skip","nah next","nah pass",
  "nah hard pass","nah delete this","nah not feeling it","nah this not ready",
  "nah production weak","nah flow off","nah hook not catching","nah beat selection off",
  "nah mixing bad","nah bro this trash","nah bro this weak","nah bro this mid",
  "nah bro this garbage","nah bro this corny","nah bro this lame",
  "nah bro this boring","nah bro this not it","nah bro skip","nah bro next",
  "nah bro pass","nah bro hard pass","nah bro delete this","nah bro not feeling it",
  "nah bro this not ready","nah bro production weak","nah bro flow off",
  "nah bro hook not catching","nah bro beat selection off","nah bro mixing bad",
  "this mid at best","this weak at best","this trash at best","this garbage at best",
  "this corny at best","this lame at best","this boring at best",
  "mid at best fr","weak at best fr","trash at best fr","garbage at best fr",
  "corny at best fr","lame at best fr","boring at best fr",
  "mid at best no cap","weak at best no cap","trash at best no cap",
  "garbage at best no cap","corny at best no cap","lame at best no cap",
  "boring at best no cap","mid at best on god","weak at best on god",
  "trash at best on god","garbage at best on god","corny at best on god",
  "lame at best on god","boring at best on god","mid at best asf",
  "weak at best asf","trash at best asf","garbage at best asf","corny at best asf",
  "lame at best asf","boring at best asf","mid at best ngl","weak at best ngl",
  "trash at best ngl","garbage at best ngl","corny at best ngl","lame at best ngl",
  "boring at best ngl","skip this","skip next","skip please","skip now",
  "skip already","skip fr","skip no cap","skip on god","skip asf","skip ngl",
  "next please","next already","next fr","next no cap","next on god","next asf",
  "next ngl","pass on this","pass fr","pass no cap","pass on god","pass asf",
  "pass ngl","hard pass fr","hard pass no cap","hard pass on god","hard pass asf",
  "hard pass ngl","delete this fr","delete this no cap","delete this on god",
  "delete this asf","delete this ngl","not feeling it fr","not feeling it no cap",
  "not feeling it on god","not feeling it asf","not feeling it ngl",
  "not it fr","not it no cap","not it on god","not it asf","not it ngl",
  "this not ready fr","this not ready no cap","this not ready on god",
  "this not ready asf","this not ready ngl","production weak fr",
  "production weak no cap","production weak on god","production weak asf",
  "production weak ngl","flow off fr","flow off no cap","flow off on god",
  "flow off asf","flow off ngl","hook not catching fr","hook not catching no cap",
  "hook not catching on god","hook not catching asf","hook not catching ngl",
  "beat selection off fr","beat selection off no cap","beat selection off on god",
  "beat selection off asf","beat selection off ngl","mixing bad fr",
  "mixing bad no cap","mixing bad on god","mixing bad asf","mixing bad ngl",

  // ── TRASH / NEGATIVE (Mixed Case) ────────────────────────────
  "Trash","Weak","Mid","Skip","Nah","Not it","Pass on this one","Not feeling it",
  "This not it","Nah bro","Mid at best","Production weak",
  "Nah this trash","Nah this weak","Nah this mid","Nah this garbage",
  "Nah this corny","Nah this lame","Nah this boring","Nah this not it",
  "Nah skip","Nah next","Nah pass","Nah hard pass","Nah delete this",
  "Nah not feeling it","Nah this not ready","Nah production weak",
  "Nah flow off","Nah hook not catching","Nah beat selection off","Nah mixing bad",
  "This mid fr","This weak fr","This trash fr","This garbage fr","This corny fr",
  "This lame fr","This boring fr","This not it fr","Skip fr","Next fr","Pass fr",
  "Hard pass fr","Delete this fr","Not feeling it fr","Not it fr",
  "This not ready fr","Production weak fr","Flow off fr","Hook not catching fr",
  "Beat selection off fr","Mixing bad fr","Mid at best fr","Weak at best fr",
  "Trash at best fr","Garbage at best fr","Corny at best fr","Lame at best fr",
  "Boring at best fr","Skip this fr","Next please fr","Pass on this fr",
  "Hard pass on this fr","Delete this please fr","Not feeling this fr",
  "Not it at all fr","This not ready at all fr","Production weak af fr",
  "Flow off af fr","Hook not catching af fr","Beat selection off af fr",
  "Mixing bad af fr","This mid no cap","This weak no cap","This trash no cap",
  "This garbage no cap","This corny no cap","This lame no cap","This boring no cap",
  "This not it no cap","Skip no cap","Next no cap","Pass no cap","Hard pass no cap",
  "Delete this no cap","Not feeling it no cap","Not it no cap",
  "This not ready no cap","Production weak no cap","Flow off no cap",
  "Hook not catching no cap","Beat selection off no cap","Mixing bad no cap",
  "Mid at best no cap","Weak at best no cap","Trash at best no cap",
  "Garbage at best no cap","Corny at best no cap","Lame at best no cap",
  "Boring at best no cap",

  // ── TRASH / NEGATIVE (UPPERCASE) ─────────────────────────────
  "TRASH","WEAK","MID","SKIP","NEXT","NAH","NOPE","NOT IT","PASS","HARD PASS",
  "GARBAGE","CORNY","LAME","BORING","YAWN","DELETE THIS","NOT FEELING IT",
  "THIS NOT IT","NAH BRO","SKIP SKIP SKIP","MID AT BEST","PRODUCTION WEAK",
  "FLOW OFF","HOOK NOT CATCHING","BEAT SELECTION OFF","MIXING BAD","THIS NOT READY",
  "NAH THIS TRASH","NAH THIS WEAK","NAH THIS MID","NAH THIS GARBAGE",
  "NAH THIS CORNY","NAH THIS LAME","NAH THIS BORING","NAH THIS NOT IT",
  "NAH SKIP","NAH NEXT","NAH PASS","NAH HARD PASS","NAH DELETE THIS",
  "NAH NOT FEELING IT","NAH THIS NOT READY","NAH PRODUCTION WEAK",
  "NAH FLOW OFF","NAH HOOK NOT CATCHING","NAH BEAT SELECTION OFF","NAH MIXING BAD",
  "THIS MID FR","THIS WEAK FR","THIS TRASH FR","THIS GARBAGE FR","THIS CORNY FR",
  "THIS LAME FR","THIS BORING FR","THIS NOT IT FR","SKIP FR","NEXT FR","PASS FR",
  "HARD PASS FR","DELETE THIS FR","NOT FEELING IT FR","NOT IT FR",
  "THIS NOT READY FR","PRODUCTION WEAK FR","FLOW OFF FR","HOOK NOT CATCHING FR",
  "BEAT SELECTION OFF FR","MIXING BAD FR","MID AT BEST FR","WEAK AT BEST FR",
  "TRASH AT BEST FR","GARBAGE AT BEST FR","CORNY AT BEST FR","LAME AT BEST FR",
  "BORING AT BEST FR",

  // ── EMOJI ONLY ────────────────────────────────────────────────
  "🔥","🔥🔥","🔥🔥🔥","🔥🔥🔥🔥","🔥🔥🔥🔥🔥",
  "🗑️","🗑️🗑️","🗑️🗑️🗑️","🗑️🗑️🗑️🗑️",
  "🔪","🔪🔪","🔪🔪🔪",
  "🎵","🎶","🎤","🎧","🎼","🎹","🥁","🎸","🎺","🎻",
  "🙌","🙌🙌","🙌🙌🙌",
  "👏","👏👏","👏👏👏",
  "💯","💯💯","💯💯💯",
  "🤯","🤯🤯",
  "😤","😤😤",
  "🥶","🥶🥶",
  "🫡","🫡🫡",
  "🤌","🤌🤌","🤌🤌🤌",
  "💀","💀💀","💀💀💀",
  "😭","😭😭","😭😭😭",
  "🎯","🎯🎯",
  "⚡","⚡⚡","⚡⚡⚡",
  "🔊","🔊🔊",
  "🫶","🫶🫶",
  "🙏","🙏🙏",
  "😮","😮😮",
  "🤩","🤩🤩",
  "😍","😍😍",
  "🔑","🔑🔑",
  "💎","💎💎",
  "👑","👑👑",
  "🚀","🚀🚀",
  "💥","💥💥","💥💥💥",
  "🎊","🎉","🎊🎉",
  "🏆","🏆🏆",
  "⭐","⭐⭐","⭐⭐⭐",
  "✨","✨✨","✨✨✨",
  "🌊","🌊🌊",
  "🌪️","🌪️🌪️",
  "🎭","🎭🎭",
  "🎪","🎪🎪",
  "🎠","🎡","🎢",
  "🏅","🥇","🥈","🥉",
  "🎖️","🎗️",
  "🎀","🎁",
  "🎆","🎇",
  "🧨","🎑",
  "🎋","🎍",
  "🎎","🎏",
  "🎐","🎑",
  "🧧","🎃",
  "🎄","🎆",
  "🎇","🧨",
  "✅","✅✅",
  "❤️","❤️❤️","❤️❤️❤️",
  "🧡","🧡🧡",
  "💛","💛💛",
  "💚","💚💚",
  "💙","💙💙",
  "💜","💜💜",
  "🖤","🖤🖤",
  "🤍","🤍🤍",
  "🤎","🤎🤎",
  "❤️‍🔥","❤️‍🔥❤️‍🔥",
  "💯🔥","🔥💯","🎤🔥","🔥🎤","🎧🔥","🔥🎧",
  "💀🔥","🔥💀","🥶🔥","🔥🥶","🤯🔥","🔥🤯",
  "😭🔥","🔥😭","💯💯🔥","🔥💯💯",
  "🎵🔥","🔥🎵","🎶🔥","🔥🎶",
  "🤌🔥","🔥🤌","🫡🔥","🔥🫡",
  "⚡🔥","🔥⚡","💥🔥","🔥💥",
  "👑🔥","🔥👑","💎🔥","🔥💎",
  "🚀🔥","🔥🚀","🏆🔥","🔥🏆",
  "⭐🔥","🔥⭐","✨🔥","🔥✨",
  "🎯🔥","🔥🎯","🔊🔥","🔥🔊",
  "🙌🔥","🔥🙌","👏🔥","🔥👏",
  "🫶🔥","🔥🫶","🙏🔥","🔥🙏",
  "😮🔥","🔥😮","🤩🔥","🔥🤩",
  "😍🔥","🔥😍","❤️🔥","🔥❤️",
  "💯🎤","🎤💯","💯🎵","🎵💯",
  "💀💯","💯💀","🥶💯","💯🥶",
  "🤯💯","💯🤯","😭💯","💯😭",
  "🔥🔥💯","💯🔥🔥","🔥💯🔥",
  "🔥🔥🔥💯","💯🔥🔥🔥",
  "💀💀🔥","🔥💀💀","🥶🥶🔥","🔥🥶🥶",
  "🤯🤯🔥","🔥🤯🤯","😭😭🔥","🔥😭😭",
  "🤌🤌🔥","🔥🤌🤌","🫡🫡🔥","🔥🫡🫡",
  "⚡⚡🔥","🔥⚡⚡","💥💥🔥","🔥💥💥",
  "👑👑🔥","🔥👑👑","💎💎🔥","🔥💎💎",
  "🚀🚀🔥","🔥🚀🚀","🏆🏆🔥","🔥🏆🏆",
  "🎯🎯🔥","🔥🎯🎯","🔊🔊🔥","🔥🔊🔊",
  "🙌🙌🔥","🔥🙌🙌","👏👏🔥","🔥👏👏",
  "🗑️🗑️💀","💀🗑️🗑️","🗑️💀🗑️",
  "😤😤😤","😤😤","😤🗑️","🗑️😤",
  "🥱🥱","🥱🗑️","🗑️🥱",
  "😒😒","😒🗑️","🗑️😒",
  "🙄🙄","🙄🗑️","🗑️🙄",
  "😑😑","😑🗑️","🗑️😑",
  "😐😐","😐🗑️","🗑️😐",
  "🤦","🤦🤦","🤦🗑️","🗑️🤦",
  "🤷","🤷🤷","🤷🗑️","🗑️🤷",
  "👎","👎👎","👎👎👎",
  "❌","❌❌","❌❌❌",
  "🚫","🚫🚫",
  "⛔","⛔⛔",
  "🛑","🛑🛑",
  "💩","💩💩",
  "🤢","🤢🤢",
  "🤮","🤮🤮",
  "😴","😴😴",
  "💤","💤💤",

  // ── EMOJI + TEXT COMBOS ───────────────────────────────────────
  "🔥 this hard","this hard 🔥","🔥 fire","fire 🔥","🔥 bars","bars 🔥",
  "🔥 heat","heat 🔥","🔥 slaps","slaps 🔥","🔥 banger","banger 🔥",
  "🔥 goes hard","goes hard 🔥","🔥 flames","flames 🔥","🔥 crazy","crazy 🔥",
  "🔥 insane","insane 🔥","🔥 certified banger","certified banger 🔥",
  "🔥 absolute heat","absolute heat 🔥","🔥 production crazy","production crazy 🔥",
  "🔥 flow nasty","flow nasty 🔥","🔥 hook sticky","hook sticky 🔥",
  "🔥 verse hard","verse hard 🔥","💯 this hard","this hard 💯",
  "💯 fire","fire 💯","💯 bars","bars 💯","💯 heat","heat 💯",
  "💯 slaps","slaps 💯","💯 banger","banger 💯","💯 goes hard","goes hard 💯",
  "💯 flames","flames 💯","💯 crazy","crazy 💯","💯 insane","insane 💯",
  "💯 certified banger","certified banger 💯","💯 absolute heat","absolute heat 💯",
  "💯 production crazy","production crazy 💯","💯 flow nasty","flow nasty 💯",
  "💯 hook sticky","hook sticky 💯","💯 verse hard","verse hard 💯",
  "🗑️ trash","trash 🗑️","🗑️ weak","weak 🗑️","🗑️ mid","mid 🗑️",
  "🗑️ skip","skip 🗑️","🗑️ next","next 🗑️","🗑️ nah","nah 🗑️",
  "🗑️ garbage","garbage 🗑️","🗑️ corny","corny 🗑️","🗑️ lame","lame 🗑️",
  "🗑️ boring","boring 🗑️","🗑️ not it","not it 🗑️","🗑️ pass","pass 🗑️",
  "💀 this hard","this hard 💀","💀 fire","fire 💀","💀 bars","bars 💀",
  "💀 heat","heat 💀","💀 slaps","slaps 💀","💀 banger","banger 💀",
  "💀 goes hard","goes hard 💀","💀 flames","flames 💀","💀 crazy","crazy 💀",
  "💀 insane","insane 💀","💀 certified banger","certified banger 💀",
  "💀 absolute heat","absolute heat 💀","💀 production crazy","production crazy 💀",
  "💀 flow nasty","flow nasty 💀","💀 hook sticky","hook sticky 💀",
  "💀 verse hard","verse hard 💀","🤯 this hard","this hard 🤯",
  "🤯 fire","fire 🤯","🤯 bars","bars 🤯","🤯 heat","heat 🤯",
  "🤯 slaps","slaps 🤯","🤯 banger","banger 🤯","🤯 goes hard","goes hard 🤯",
  "🤯 flames","flames 🤯","🤯 crazy","crazy 🤯","🤯 insane","insane 🤯",
  "🤯 certified banger","certified banger 🤯","🤯 absolute heat","absolute heat 🤯",
  "🤯 production crazy","production crazy 🤯","🤯 flow nasty","flow nasty 🤯",
  "🤯 hook sticky","hook sticky 🤯","🤯 verse hard","verse hard 🤯",
  "⚡ this hard","this hard ⚡","⚡ fire","fire ⚡","⚡ bars","bars ⚡",
  "⚡ heat","heat ⚡","⚡ slaps","slaps ⚡","⚡ banger","banger ⚡",
  "⚡ goes hard","goes hard ⚡","⚡ flames","flames ⚡","⚡ crazy","crazy ⚡",
  "⚡ insane","insane ⚡","⚡ certified banger","certified banger ⚡",
  "⚡ absolute heat","absolute heat ⚡","⚡ production crazy","production crazy ⚡",
  "⚡ flow nasty","flow nasty ⚡","⚡ hook sticky","hook sticky ⚡",
  "⚡ verse hard","verse hard ⚡",

  // ── SHORT REACTIONS ───────────────────────────────────────────
  "yes","no","ok","wow","omg","lol","bro","fam","facts","real","period",
  "Yes","No","Ok","Wow","Omg","Lol","Bro","Fam","Facts","Real","Period",
  "YES","NO","OK","WOW","OMG","LOL","BRO","FAM","FACTS","REAL","PERIOD",
  "yep","nope","yup","nah","sure","ok ok","yea","nah nah","yep yep","nope nope",
  "Yep","Nope","Yup","Nah","Sure","Ok ok","Yea","Nah nah","Yep yep","Nope nope",
  "YEP","NOPE","YUP","NAH","SURE","OK OK","YEA","NAH NAH","YEP YEP","NOPE NOPE",
  "fr","fr fr","fr fr fr","no cap","on god","asf","ngl","lowkey","highkey",
  "Fr","Fr fr","Fr fr fr","No cap","On god","Asf","Ngl","Lowkey","Highkey",
  "FR","FR FR","FR FR FR","NO CAP","ON GOD","ASF","NGL","LOWKEY","HIGHKEY",
  "ight","aight","ight bet","aight bet","bet","bet bet","bet bet bet",
  "Ight","Aight","Ight bet","Aight bet","Bet","Bet bet","Bet bet bet",
  "IGHT","AIGHT","IGHT BET","AIGHT BET","BET","BET BET","BET BET BET",
  "say less","say less fr","say less no cap","say less on god","say less asf",
  "Say less","Say less fr","Say less no cap","Say less on god","Say less asf",
  "SAY LESS","SAY LESS FR","SAY LESS NO CAP","SAY LESS ON GOD","SAY LESS ASF",
  "word","word fr","word no cap","word on god","word asf","word ngl",
  "Word","Word fr","Word no cap","Word on god","Word asf","Word ngl",
  "WORD","WORD FR","WORD NO CAP","WORD ON GOD","WORD ASF","WORD NGL",
  "facts fr","facts no cap","facts on god","facts asf","facts ngl",
  "Facts fr","Facts no cap","Facts on god","Facts asf","Facts ngl",
  "FACTS FR","FACTS NO CAP","FACTS ON GOD","FACTS ASF","FACTS NGL",
  "real fr","real no cap","real on god","real asf","real ngl",
  "Real fr","Real no cap","Real on god","Real asf","Real ngl",
  "REAL FR","REAL NO CAP","REAL ON GOD","REAL ASF","REAL NGL",
  "period fr","period no cap","period on god","period asf","period ngl",
  "Period fr","Period no cap","Period on god","Period asf","Period ngl",
  "PERIOD FR","PERIOD NO CAP","PERIOD ON GOD","PERIOD ASF","PERIOD NGL",

  // ── CROWD REACTIONS ───────────────────────────────────────────
  "lets go","ayeee","yooo","woah","yessss","lets goooo","ayyyy","yoooo","woooo",
  "Lets go","Ayeee","Yooo","Woah","Yessss","Ayyyy","Yoooo","Woooo",
  "LETS GO","AYEEE","YOOOOO","WOAH","YESSSS","AYYYY","YOOOO","WOOOO",
  "lets go fr","ayeee fr","yooo fr","woah fr","yessss fr","lets goooo fr",
  "Lets go fr","Ayeee fr","Yooo fr","Woah fr","Yessss fr","Lets goooo fr",
  "LETS GO FR","AYEEE FR","YOOO FR","WOAH FR","YESSSS FR","LETS GOOOO FR",
  "lets go no cap","ayeee no cap","yooo no cap","woah no cap","yessss no cap",
  "Lets go no cap","Ayeee no cap","Yooo no cap","Woah no cap","Yessss no cap",
  "LETS GO NO CAP","AYEEE NO CAP","YOOO NO CAP","WOAH NO CAP","YESSSS NO CAP",
  "lets go on god","ayeee on god","yooo on god","woah on god","yessss on god",
  "Lets go on god","Ayeee on god","Yooo on god","Woah on god","Yessss on god",
  "LETS GO ON GOD","AYEEE ON GOD","YOOO ON GOD","WOAH ON GOD","YESSSS ON GOD",
  "lets go asf","ayeee asf","yooo asf","woah asf","yessss asf",
  "Lets go asf","Ayeee asf","Yooo asf","Woah asf","Yessss asf",
  "LETS GO ASF","AYEEE ASF","YOOO ASF","WOAH ASF","YESSSS ASF",
  "lets go ngl","ayeee ngl","yooo ngl","woah ngl","yessss ngl",
  "Lets go ngl","Ayeee ngl","Yooo ngl","Woah ngl","Yessss ngl",
  "LETS GO NGL","AYEEE NGL","YOOO NGL","WOAH NGL","YESSSS NGL",
  "aye","aye aye","aye aye aye","ayy","ayy ayy","ayy ayy ayy",
  "Aye","Aye aye","Aye aye aye","Ayy","Ayy ayy","Ayy ayy ayy",
  "AYE","AYE AYE","AYE AYE AYE","AYY","AYY AYY","AYY AYY AYY",
  "woo","woo woo","woo woo woo","wooo","wooo wooo","wooo wooo wooo",
  "Woo","Woo woo","Woo woo woo","Wooo","Wooo wooo","Wooo wooo wooo",
  "WOO","WOO WOO","WOO WOO WOO","WOOO","WOOO WOOO","WOOO WOOO WOOO",
  "yoo","yoo yoo","yoo yoo yoo","yooo","yooo yooo","yooo yooo yooo",
  "Yoo","Yoo yoo","Yoo yoo yoo","Yooo","Yooo yooo","Yooo yooo yooo",
  "YOO","YOO YOO","YOO YOO YOO","YOOO","YOOO YOOO","YOOO YOOO YOOO",
];

export type ReactionType = "hype" | "trash" | "knife" | "bars" | "weak" | "next";

// Subsets of COMMENT_VARIANTS filtered by tone — used for triggered reactions
// These are computed lazily so they reference the full 1000+ pool
const getFireVariants = () => COMMENT_VARIANTS.filter(c =>
  !c.includes("trash") && !c.includes("TRASH") &&
  !c.includes("weak") && !c.includes("WEAK") &&
  !c.includes("mid") && !c.includes("MID") &&
  !c.includes("skip") && !c.includes("SKIP") &&
  !c.includes("next") && !c.includes("NEXT") &&
  !c.includes("garbage") && !c.includes("GARBAGE") &&
  !c.includes("corny") && !c.includes("CORNY") &&
  !c.includes("lame") && !c.includes("LAME") &&
  !c.includes("nah") && !c.includes("NAH") &&
  !c.includes("boring") && !c.includes("BORING")
);

const getTrashVariants = () => COMMENT_VARIANTS.filter(c =>
  c.includes("trash") || c.includes("TRASH") ||
  c.includes("weak") || c.includes("WEAK") ||
  c.includes("mid") || c.includes("MID") ||
  c.includes("skip") || c.includes("SKIP") ||
  c.includes("next") || c.includes("NEXT") ||
  c.includes("garbage") || c.includes("GARBAGE") ||
  c.includes("corny") || c.includes("CORNY") ||
  c.includes("lame") || c.includes("LAME") ||
  c.includes("nah") || c.includes("NAH") ||
  c.includes("boring") || c.includes("BORING") ||
  c.includes("🗑️") || c.includes("👎") || c.includes("❌") ||
  c.includes("🚫") || c.includes("⛔") || c.includes("🛑") ||
  c.includes("💩") || c.includes("🤢") || c.includes("🤮") ||
  c.includes("😴") || c.includes("💤") || c.includes("😒") ||
  c.includes("🙄") || c.includes("😑") || c.includes("😐") ||
  c.includes("🤦") || c.includes("🤷")
);

const REACTION_MAP: Record<ReactionType, string[] | (() => string[])> = {
  // 🔥 Hype — full fire/positive pool from COMMENT_VARIANTS
  hype: getFireVariants,
  // 🗑️ Trash — full trash/negative pool from COMMENT_VARIANTS
  trash: getTrashVariants,
  // 🔪 Knife — ONLY knife emojis, no text
  knife: ["🔪","🔪🔪","🔪🔪🔪","🔪🔪🔪🔪","🔪🔪🔪🔪🔪"],
  // 🎵 Bars — fire/positive pool (same as hype)
  bars: getFireVariants,
  // 😴 Weak — trash/negative pool (same as trash)
  weak: getTrashVariants,
  // ⏭️ Next — full pool (any reaction, skip-leaning)
  next: () => COMMENT_VARIANTS,
};

// Fake user accounts — rap names, real-sounding names, one-word nicknames
// Helper to build a fake user entry
const fu = (id: number, username: string, artistName: string | null = username) =>
  ({ id, username, artistName, role: "user" as const });

const FAKE_USER_ACCOUNTS = [
  // ── Rap / street names ──────────────────────────────────────────
  fu(-1,"LilSavage","Lil Savage"), fu(-2,"YoungBlood","YoungBlood"), fu(-3,"TrapKing","Trap King"),
  fu(-4,"BigFlex","Big Flex"), fu(-5,"SlimDuece","Slim Duece"), fu(-6,"DoughBoy","Dough Boy"),
  fu(-7,"GhostFace","Ghost Face"), fu(-8,"LilReek","Lil Reek"), fu(-9,"YoungKing","Young King"),
  fu(-10,"BigBando","Big Bando"), fu(-11,"TrapStar","Trap Star"), fu(-12,"LilGrip","Lil Grip"),
  fu(-13,"YoungDre","Young Dre"), fu(-14,"BigSlime","Big Slime"), fu(-15,"LilTrap","Lil Trap"),
  fu(-16,"YoungMoney","Young Money"), fu(-17,"BigCash","Big Cash"), fu(-18,"LilDuece","Lil Duece"),
  fu(-19,"TrapGod","Trap God"), fu(-20,"YoungSavage","Young Savage"), fu(-21,"BigDrako","Big Drako"),
  fu(-22,"LilBando","Lil Bando"), fu(-23,"SlimBaller","Slim Baller"), fu(-24,"YoungFlame","Young Flame"),
  fu(-25,"LilBoss","Lil Boss"), fu(-26,"BigStacks","Big Stacks"), fu(-27,"YoungRich","Young Rich"),
  fu(-28,"TrapBaby","Trap Baby"), fu(-29,"LilPeso","Lil Peso"), fu(-30,"BigWave","Big Wave"),
  fu(-31,"YoungFlex","Young Flex"), fu(-32,"LilBank","Lil Bank"), fu(-33,"BigHeat","Big Heat"),
  fu(-34,"YoungGrip","Young Grip"), fu(-35,"LilChief","Lil Chief"), fu(-36,"BigFire","Big Fire"),
  fu(-37,"YoungBars","Young Bars"), fu(-38,"LilStar","Lil Star"), fu(-39,"BigVibes","Big Vibes"),
  fu(-40,"YoungHeat","Young Heat"), fu(-41,"LilCash","Lil Cash"), fu(-42,"BigBoss","Big Boss"),
  fu(-43,"YoungStacks","Young Stacks"), fu(-44,"LilFlex","Lil Flex"), fu(-45,"BigSlick","Big Slick"),
  fu(-46,"YoungGhost","Young Ghost"), fu(-47,"LilWave","Lil Wave"), fu(-48,"BigTrap","Big Trap"),
  fu(-49,"YoungPeso","Young Peso"), fu(-50,"LilDrip","Lil Drip"),
  // ── Real-sounding names ─────────────────────────────────────────
  fu(-51,"Marcus_D","Marcus D"), fu(-52,"DeShawn"), fu(-53,"Jayvon"), fu(-54,"TyreekM","Tyreek M"),
  fu(-55,"Darius_K","Darius K"), fu(-56,"Malik_J","Malik J"), fu(-57,"Kevon"), fu(-58,"Rashad_P","Rashad P"),
  fu(-59,"Donte"), fu(-60,"Jamal_W","Jamal W"), fu(-61,"Terrell"), fu(-62,"Quincy_B","Quincy B"),
  fu(-63,"Devontae"), fu(-64,"Lamar_G","Lamar G"), fu(-65,"Kendrick_F","Kendrick F"),
  fu(-66,"Darnell"), fu(-67,"Jalen_R","Jalen R"), fu(-68,"Antoine"), fu(-69,"Marquise"),
  fu(-70,"Dominic_T","Dominic T"), fu(-71,"Reginald"), fu(-72,"Dwayne_L","Dwayne L"),
  fu(-73,"Cortez"), fu(-74,"Elijah_M","Elijah M"), fu(-75,"Bryce_H","Bryce H"),
  fu(-76,"Tavion"), fu(-77,"Kameron"), fu(-78,"Jaylen_B","Jaylen B"), fu(-79,"Deandre"),
  fu(-80,"Rasheed"), fu(-81,"Tyrone_C","Tyrone C"), fu(-82,"Deshawn_M","Deshawn M"),
  fu(-83,"Kareem"), fu(-84,"Alonzo"), fu(-85,"Tremaine"), fu(-86,"Darius_W","Darius W"),
  fu(-87,"Jermaine"), fu(-88,"Damien_L","Damien L"), fu(-89,"Ronell"), fu(-90,"Kevontae"),
  fu(-91,"Shaquille"), fu(-92,"Trevon"), fu(-93,"Dontrell"), fu(-94,"Jaquez"), fu(-95,"Rayshawn"),
  fu(-96,"Kadeem"), fu(-97,"Demetrius"), fu(-98,"Tavares"), fu(-99,"Leondre"), fu(-100,"Zayden"),
  // ── Street / Detroit one-word nicknames ────────────────────────
  fu(-101,"Steelo"), fu(-102,"Grimy"), fu(-103,"Hustle"), fu(-104,"Grind"), fu(-105,"Clutch"),
  fu(-106,"Finesse"), fu(-107,"Drako"), fu(-108,"Menace"), fu(-109,"Reckless"), fu(-110,"Bandit"),
  fu(-111,"Outlaw"), fu(-112,"Rebel"), fu(-113,"Havoc"), fu(-114,"Fury"), fu(-115,"Sauce"),
  fu(-116,"Stackz"), fu(-117,"Gucci_J","Gucci J"), fu(-118,"Drizzy_K","Drizzy K"), fu(-119,"Capo"), fu(-120,"Jefe"),
  fu(-121,"Plug"), fu(-122,"Shooter"), fu(-123,"Loco"), fu(-124,"Papi"), fu(-125,"Ese"),
  fu(-126,"Sosa"), fu(-127,"Keef"), fu(-128,"Durk_fan","Durk fan"), fu(-129,"Bibby"), fu(-130,"Reese"),
  fu(-131,"Melly"), fu(-132,"Kodak"), fu(-133,"NBA_fan","NBA fan"), fu(-134,"Polo"), fu(-135,"Uzi_fan","Uzi fan"),
  fu(-136,"Thug_fan","Thug fan"), fu(-137,"Gunna_fan","Gunna fan"), fu(-138,"Latto_fan","Latto fan"), fu(-139,"Cardi_fan","Cardi fan"), fu(-140,"Meg_fan","Meg fan"),
  fu(-141,"JID_fan","JID fan"), fu(-142,"Smino_fan","Smino fan"), fu(-143,"Saba_fan","Saba fan"), fu(-144,"Noname_fan","Noname fan"), fu(-145,"Chance_fan","Chance fan"),
  fu(-146,"Vic_fan","Vic fan"), fu(-147,"Supa"), fu(-148,"Beezy"), fu(-149,"Skully"), fu(-150,"Dolo"),
  // ── Social-media style handles ──────────────────────────────────
  fu(-176,"itsyoboy_k","itsyoboy_k"), fu(-177,"real_dre","real_dre"), fu(-178,"traplife_99","traplife_99"),
  fu(-179,"wavyvibes","wavyvibes"), fu(-180,"drip_szn","drip_szn"), fu(-181,"bars_only","bars_only"),
  fu(-182,"no_cap_fr","no_cap_fr"), fu(-183,"on_god_bro","on_god_bro"), fu(-184,"slimyboyz","slimyboyz"),
  fu(-185,"bigbandolife","bigbandolife"), fu(-186,"trapszn2024","trapszn2024"), fu(-187,"youngmillz","youngmillz"),
  fu(-188,"hoodrich_k","hoodrich_k"), fu(-189,"streetz_only","streetz_only"), fu(-190,"liveordie_t","liveordie_t"),
  fu(-191,"grindmode_j","grindmode_j"), fu(-192,"stackz_up","stackz_up"), fu(-193,"trapstar_d","trapstar_d"),
  fu(-194,"wavybaby_m","wavybaby_m"), fu(-195,"flexgod_r","flexgod_r"), fu(-196,"richkid_b","richkid_b"),
  fu(-197,"barsforever","barsforever"), fu(-198,"trapqueen_v","trapqueen_v"), fu(-199,"slimthugfan","slimthugfan"),
  fu(-200,"detroitborn","detroitborn"), fu(-201,"michiganmade","michiganmade"), fu(-202,"313allday","313allday"),
  fu(-203,"motown_rep","motown_rep"), fu(-204,"d_town_finest","d_town_finest"), fu(-205,"midwest_wave","midwest_wave"),
  fu(-206,"flyboy_z","flyboy_z"), fu(-207,"icyvibes_c","icyvibes_c"), fu(-208,"drillszn_b","drillszn_b"),
  fu(-209,"hiphophead_j","hiphophead_j"), fu(-210,"rapfan_real","rapfan_real"),
  // ── More Detroit/Michigan rap names ────────────────────────────
  fu(-211,"LilDrip","Lil Drip"), fu(-212,"BigMeech_fan","Big Meech fan"), fu(-213,"YoungDro_fan","YoungDro fan"),
  fu(-214,"LilVibe","Lil Vibe"), fu(-215,"BigSauce","Big Sauce"), fu(-216,"YoungJeezy_fan","Jeezy fan"),
  fu(-217,"LilSmoke","Lil Smoke"), fu(-218,"BigSean_fan","Big Sean fan"), fu(-219,"YoungDrip","Young Drip"),
  fu(-220,"BabyFace_fan","Babyface fan"), fu(-221,"BigMelo","Big Melo"), fu(-222,"Sada_fan","Sada fan"),
  fu(-223,"LilKing","Lil King"), fu(-224,"Peezy_fan","Peezy fan"), fu(-225,"Gmac_fan","Gmac fan"),
  fu(-226,"LilRich","Lil Rich"), fu(-227,"Icewear_fan","Icewear fan"), fu(-228,"Doughboyz_fan","Doughboyz fan"),
  fu(-229,"Payroll_fan","Payroll fan"), fu(-230,"Blade_Icewood_fan","Blade fan"),
  fu(-231,"Lil_Racks","Lil Racks"), fu(-232,"Big_Racks","Big Racks"), fu(-233,"Young_Racks","Young Racks"),
  fu(-234,"Lil_Bands","Lil Bands"), fu(-235,"BandGang_fan","BandGang fan"), fu(-236,"Young_Bands","Young Bands"),
  fu(-237,"Lil_Guap","Lil Guap"), fu(-238,"Big_Guap","Big Guap"), fu(-239,"Tee_Grizzley_fan","Tee fan"),
  fu(-240,"Lil_Bag","Lil Bag"), fu(-241,"Big_Bag","Big Bag"), fu(-242,"Young_Bag","Young Bag"),
  fu(-243,"Lil_Sauce","Lil Sauce"), fu(-244,"Danny_Brown_fan","Danny fan"), fu(-245,"Young_Sauce","Young Sauce"),
  fu(-246,"Lil_Swag","Lil Swag"), fu(-247,"Big_Swag","Big Swag"), fu(-248,"Trick_fan","Trick fan"),
  fu(-249,"Lil_Fetti","Lil Fetti"), fu(-250,"Big_Fetti","Big Fetti"),
  // ── More real names ─────────────────────────────────────────────
  fu(-251,"Keshawn"), fu(-252,"Treyvon"), fu(-253,"Daquan"), fu(-254,"Lebron_fan","Lebron fan"),
  fu(-255,"Jamarcus"), fu(-256,"Rontavious"), fu(-257,"Devion"), fu(-258,"Kordell"),
  fu(-259,"Trayvion"), fu(-260,"Demarion"), fu(-261,"Keontae"), fu(-262,"Jayquan"),
  fu(-263,"Dontavious"), fu(-264,"Marquavious"), fu(-265,"Travontae"),
  fu(-266,"Shakeem"), fu(-267,"Raekwon"), fu(-268,"Latrell"), fu(-269,"Dontarius"), fu(-270,"Javonte"),
  fu(-271,"Tyquan"), fu(-272,"Deshawn_B","Deshawn B"), fu(-273,"Keon"), fu(-274,"Dontae"), fu(-275,"Javion"),
  fu(-276,"Semaj"), fu(-277,"Amari"), fu(-278,"Zion_T","Zion T"), fu(-279,"Kyrie_fan","Kyrie fan"), fu(-280,"Jayden_R","Jayden R"),
  // ── More real-sounding social handles ────────────────────────────────
  fu(-281,"drako_313","drako_313"), fu(-282,"muzik_head","muzik_head"), fu(-283,"trap_vibes_k","trap_vibes_k"),
  fu(-284,"808_bass","808_bass"), fu(-285,"trap_808","trap_808"), fu(-286,"real_rap_only","real_rap_only"),
  fu(-287,"hiphop_4eva","hiphop_4eva"), fu(-288,"rap_god_99","rap_god_99"), fu(-289,"bars_n_beats","bars_n_beats"),
  fu(-290,"beat_junkie","beat_junkie"), fu(-291,"313_finest","313_finest"), fu(-292,"flow_check","flow_check"),
  fu(-293,"detroit_made_j","detroit_made_j"), fu(-294,"midwest_finest","midwest_finest"), fu(-295,"mitten_music","mitten_music"),
  fu(-296,"d_town_k","d_town_k"), fu(-297,"bigbro_watching","bigbro_watching"), fu(-298,"from_the_d","from_the_d"),
  fu(-299,"mmm_supporter","mmm_supporter"), fu(-300,"street_certified","street_certified"),
  // ── Realistic fan account style handles ────────────────────────────────
  fu(-301,"jaylen.313",null), fu(-302,"kev_wavyy",null), fu(-303,"dre_from_d",null),
  fu(-304,"michiganboy_t",null), fu(-305,"realones_only",null), fu(-306,"trapwave_b",null),
  fu(-307,"youngbul_j",null), fu(-308,"stackin_daily",null), fu(-309,"no_skips_ever",null),
  fu(-310,"rap_fan_313",null),
];

export interface FakeLiveChatConfig {
  /** Comment interval in ms (normal mode). Default 4000-12000ms. Range: 500-30000 */
  commentIntervalMs: number;
  /** Min viewer count. Default 50. */
  viewerMin: number;
  /** Max viewer count. Default 250. */
  viewerMax: number;
}

interface UseFakeLiveChatOptions {
  /** When true, this client is the admin — fake messages are emitted to all viewers via socket */
  isAdmin?: boolean;
  /** Socket emit function from useChat — used by admin to broadcast fake messages */
  emitFakeChatMessage?: (data: FakeChatMessageData) => void;
  /** Socket emit function from useChat — used by admin to broadcast chat control settings */
  emitChatControls?: (data: ChatControlsData) => void;
  /** Socket emit function from useChat — used by admin to sync settings with other admins */
  emitAdminControlSync?: (data: AdminControlSyncData) => void;
}

export function useFakeLiveChat({
  isAdmin = false,
  emitFakeChatMessage,
  emitChatControls,
  emitAdminControlSync,
}: UseFakeLiveChatOptions = {}) {
  const [viewerCount, setViewerCount] = useState(50);
  const [fakeMessages, setFakeMessages] = useState<FakeChatMessage[]>([]);
  const [triggeredReaction, setTriggeredReaction] = useState<ReactionType | null>(null);
  const [chatPool, setChatPool] = useState<any[]>([]);
  // Configurable controls
  const [commentIntervalMs, setCommentIntervalMs] = useState(6000); // default ~6s between msgs
  const [viewerMin, setViewerMin] = useState(50);
  const [viewerMax, setViewerMax] = useState(250);
  // Ghost vote controls — interval in seconds between auto-incremented ghost votes (0 = off)
  const [ghostFireIntervalSec, setGhostFireIntervalSec] = useState(0);
  const [ghostTrashIntervalSec, setGhostTrashIntervalSec] = useState(0);
  const [ghostFireCount, setGhostFireCount] = useState(0);
  const [ghostTrashCount, setGhostTrashCount] = useState(0);
  // Auto-increment ghost fire votes on interval
  useEffect(() => {
    if (ghostFireIntervalSec <= 0) return;
    const id = setInterval(() => {
      setGhostFireCount(prev => prev + 1);
    }, ghostFireIntervalSec * 1000);
    return () => clearInterval(id);
  }, [ghostFireIntervalSec]);
  // Auto-increment ghost trash votes on interval
  useEffect(() => {
    if (ghostTrashIntervalSec <= 0) return;
    const id = setInterval(() => {
      setGhostTrashCount(prev => prev + 1);
    }, ghostTrashIntervalSec * 1000);
    return () => clearInterval(id);
  }, [ghostTrashIntervalSec]);

  // Comment sentiment bias: 0 = pure trash, 50 = mixed, 100 = pure fire
  const [sentimentBias, setSentimentBias] = useState(50);

  // Track last comment time per user (userId -> timestamp)
  const lastCommentTime = useRef<Record<string, number>>({});

  // Admin: when a fake message is generated, also emit it over the socket so viewers see it
  const emitFakeChatMessageRef = useRef(emitFakeChatMessage);
  emitFakeChatMessageRef.current = emitFakeChatMessage;
  const isAdminRef = useRef(isAdmin);
  isAdminRef.current = isAdmin;

  // Intercept setFakeMessages to also emit over socket when admin
  const addFakeMessage = useCallback((msg: FakeChatMessage) => {
    setFakeMessages(prev => [...prev, msg].slice(-50));
    if (isAdminRef.current && emitFakeChatMessageRef.current) {
      emitFakeChatMessageRef.current({
        username: msg.username,
        text: msg.text,
        userId: msg.userId,
        timestamp: msg.timestamp,
      });
    }
  }, []);

  const { data: allUsers } = trpc.admin.listUsers.useQuery(
    { limit: 100, offset: 0 },
    { staleTime: 1000 * 60 * 5, retry: false }
  );

  // Build chat pool: real users with names + some User-style accounts
  useEffect(() => {
    const realNameUsers = (allUsers ?? []).filter(u => {
      const name = u.artistName || u.username || "";
      // Only regular users — exclude admins and judges
      return name.trim().length > 0 && u.role === "user";
    });

    // Shuffle real users and pick up to 3 (keep real accounts rare)
    const shuffledReal = [...realNameUsers].sort(() => Math.random() - 0.5).slice(0, 3);

    // Pull a large random slice from the 310-account fake pool
    const fakeCount = 60 + Math.floor(Math.random() * 40); // 60-100 fake accounts active
    const shuffledFake = [...FAKE_USER_ACCOUNTS].sort(() => Math.random() - 0.5).slice(0, fakeCount);

    setChatPool([...shuffledFake, ...shuffledReal]);
  }, [allUsers]);

  // Viewer count fluctuation — respects viewerMin/viewerMax
  useEffect(() => {
    const tick = () => {
      setViewerCount(prev => {
        const range = viewerMax - viewerMin;
        const change = Math.floor(Math.random() * Math.max(range * 0.16, 10)) - Math.floor(Math.max(range * 0.08, 5));
        return Math.max(viewerMin, Math.min(viewerMax, prev + change));
      });
    };
    // Snap current count into new range immediately
    setViewerCount(prev => Math.max(viewerMin, Math.min(viewerMax, prev)));
    const id = setInterval(tick, 3000 + Math.random() * 5000);
    return () => clearInterval(id);
  }, [viewerMin, viewerMax]);

  // Auto-chat messages with per-user cooldown
  useEffect(() => {
    if (chatPool.length === 0) return;

    const interval = setInterval(() => {
      const now = Date.now();

      // During triggered reaction, skip cooldown
      if (triggeredReaction) {
        const randomUser = chatPool[Math.floor(Math.random() * chatPool.length)];
        const poolOrFn = REACTION_MAP[triggeredReaction];
        const pool = typeof poolOrFn === "function" ? poolOrFn() : poolOrFn;
        const text = pool[Math.floor(Math.random() * pool.length)];
        const key = String(randomUser.id);
        lastCommentTime.current[key] = now;

        addFakeMessage({
          id: `fake-${now}-${Math.random()}`,
          username: randomUser.artistName || randomUser.username || `User${randomUser.id}`,
          text,
          timestamp: now,
          role: "user" as const,
          userId: randomUser.id,
        });
        return;
      }

      // Normal mode: pick a user who hasn't commented in 2-3 minutes
      const cooldownMs = (120 + Math.random() * 60) * 1000; // 2-3 min
      const eligible = chatPool.filter(u => {
        const last = lastCommentTime.current[String(u.id)] ?? 0;
        return now - last >= cooldownMs;
      });

      // If no eligible users, skip this tick
      if (eligible.length === 0) return;

      const randomUser = eligible[Math.floor(Math.random() * eligible.length)];
      // Apply sentiment bias: 0=trash, 50=mixed, 100=fire
      const roll = Math.random() * 100;
      let commentPool: string[];
      if (sentimentBias >= 80) {
        // Mostly fire
        commentPool = roll < sentimentBias ? getFireVariants() : COMMENT_VARIANTS;
      } else if (sentimentBias <= 20) {
        // Mostly trash
        commentPool = roll < (100 - sentimentBias) ? getTrashVariants() : COMMENT_VARIANTS;
      } else {
        // Mixed — weighted blend
        const fireChance = sentimentBias / 100;
        commentPool = roll < fireChance * 100 ? getFireVariants() : getTrashVariants();
      }
      if (!commentPool || commentPool.length === 0) commentPool = COMMENT_VARIANTS;
      const text = commentPool[Math.floor(Math.random() * commentPool.length)];
      const key = String(randomUser.id);
      lastCommentTime.current[key] = now;

      addFakeMessage({
          id: `fake-${now}-${Math.random()}`,
          username: randomUser.artistName || randomUser.username || `User${randomUser.id}`,
          text,
          timestamp: now,
          role: "user" as const,
          userId: randomUser.id,
        });

    }, triggeredReaction ? 300 : commentIntervalMs * (0.7 + Math.random() * 0.6));

    return () => clearInterval(interval);
  }, [chatPool, triggeredReaction, commentIntervalMs, sentimentBias, addFakeMessage]);

  const triggerReaction = (reaction: ReactionType, duration = 3000) => {
    setTriggeredReaction(reaction);
    setTimeout(() => setTriggeredReaction(null), duration);
  };

  // Viewer: receive fake messages from admin via socket
  const receiveFakeMessage = useCallback((data: FakeChatMessageData) => {
    if (isAdminRef.current) return; // admin doesn't receive their own relay
    const msg: FakeChatMessage = {
      id: `relay-${data.timestamp}-${Math.random()}`,
      username: data.username,
      text: data.text,
      timestamp: data.timestamp,
      role: "user" as const,
      userId: data.userId ?? -999,
    };
    setFakeMessages(prev => [...prev, msg].slice(-50));
  }, []);

  // Viewer: receive chat control settings from admin via socket
  const receiveChatControls = useCallback((data: ChatControlsData) => {
    if (isAdminRef.current) return; // admin doesn't apply their own relay
    if (data.commentIntervalMs !== undefined) setCommentIntervalMs(data.commentIntervalMs);
    if (data.sentimentBias !== undefined) setSentimentBias(data.sentimentBias);
    if (data.ghostFireIntervalSec !== undefined) setGhostFireIntervalSec(data.ghostFireIntervalSec);
    if (data.ghostTrashIntervalSec !== undefined) setGhostTrashIntervalSec(data.ghostTrashIntervalSec);
  }, []);

  // Admin: receive control settings from other admins via socket
  const receiveAdminControlSync = useCallback((data: AdminControlSyncData) => {
    if (!isAdminRef.current) return; // only admins receive this
    if (data.commentIntervalMs !== undefined) setCommentIntervalMs(data.commentIntervalMs);
    if (data.sentimentBias !== undefined) setSentimentBias(data.sentimentBias);
    if (data.ghostFireIntervalSec !== undefined) setGhostFireIntervalSec(data.ghostFireIntervalSec);
    if (data.ghostTrashIntervalSec !== undefined) setGhostTrashIntervalSec(data.ghostTrashIntervalSec);
    if (data.viewerMin !== undefined) setViewerMin(data.viewerMin);
    if (data.viewerMax !== undefined) setViewerMax(data.viewerMax);
  }, []);

  // Admin: broadcast chat controls whenever they change
  const emitChatControlsRef = useRef(emitChatControls);
  emitChatControlsRef.current = emitChatControls;

  return {
    viewerCount,
    fakeMessages,
    triggerReaction,
    triggeredReaction,
    // Slider controls
    commentIntervalMs,
    setCommentIntervalMs,
    viewerMin,
    setViewerMin,
    viewerMax,
    setViewerMax,
    // Ghost vote controls
    ghostFireCount,
    setGhostFireCount,
    ghostTrashCount,
    setGhostTrashCount,
    ghostFireIntervalSec,
    setGhostFireIntervalSec,
    ghostTrashIntervalSec,
    setGhostTrashIntervalSec,
    // Comment sentiment bias (0=trash, 50=mixed, 100=fire)
    sentimentBias,
    setSentimentBias,
    // Socket relay helpers (pass to useChat callbacks)
    receiveFakeMessage,
    receiveChatControls,
    receiveAdminControlSync,
  };
}
