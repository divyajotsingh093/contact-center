import { describe, expect, it } from "vitest";
import { parseAgentText } from "@/integrations/kamios";

describe("AI Hub reply parsing", () => {
  it("reads fenced, bare and embedded JSON, and rejects prose", () => {
    expect(parseAgentText('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseAgentText('{"a":2}')).toEqual({ a: 2 });
    expect(parseAgentText('Here you go: {"a":3} hope that helps')).toEqual({ a: 3 });
    expect(parseAgentText({ a: 4 })).toEqual({ a: 4 });
    expect(parseAgentText("no json here")).toBeNull();
  });
});
