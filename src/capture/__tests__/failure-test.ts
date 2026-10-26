import { decodeFlags, decodeIssue, describeFailure, encodeFlags, flaggedPhotos, flaggedPlates, privacyReasons, unreadablePlate } from "../failure";

const job = (error_code: string | null, error_message: string | null = null) => ({ error_code, error_message });

describe("flaggedPlates", () => {
  it("reads the positions the privacy check names", () => {
    expect(flaggedPlates("Person or private text detected in photo position(s): 2, 0. Retake those photos.")).toEqual([0, 2]);
    expect(flaggedPlates("photo position(s): 3.")).toEqual([3]);
  });

  it("returns nothing when no positions are named", () => {
    expect(flaggedPlates(null)).toEqual([]);
    expect(flaggedPlates("provider returned 500")).toEqual([]);
  });
});

describe("retake reasons", () => {
  const NEW = "Person or private text detected in photo position(s): 0, 2, 3. Retake those photos without people, mail, documents or lit screens. Reasons: 0=person; 2=private_text; 3=person+private_text.";
  const OLD = "Person or private text detected in photo position(s): 0, 2. Retake those photos without people, mail, documents or lit screens.";

  it("reads each position's reason from newer servers", () => {
    expect(flaggedPlates(NEW)).toEqual([0, 2, 3]);
    expect([...privacyReasons(NEW)]).toEqual([[0, "person"], [2, "private_text"], [3, "person_private_text"]]);
    expect(flaggedPhotos(NEW)).toEqual([
      { slot: 0, reason: "person" },
      { slot: 2, reason: "private_text" },
      { slot: 3, reason: "person_private_text" },
    ]);
  });

  it("falls back to the general reason with an older server's message", () => {
    expect(privacyReasons(OLD).size).toBe(0);
    expect(flaggedPhotos(OLD)).toEqual([{ slot: 0, reason: "general" }, { slot: 2, reason: "general" }]);
  });

  it("ignores reasons it doesn't know, and positions the prefix doesn't name", () => {
    expect(flaggedPhotos("photo position(s): 1. Reasons: 1=glare; 4=person.")).toEqual([{ slot: 1, reason: "general" }]);
  });

  it("reads the photo a photo_unavailable error names", () => {
    expect(unreadablePlate("photo position 3 could not be downloaded (HTTP 404)")).toBe(3);
    expect(unreadablePlate("photo position 1 is larger than 15 MB")).toBe(1);
    expect(unreadablePlate("photo position 2 is empty or larger than 15 MB")).toBe(2);
    expect(unreadablePlate("The photos are too large to send together")).toBeNull();
  });

  it("round-trips the review screen's ?flag= value; plain positions (older builds) read as general", () => {
    const flagged = flaggedPhotos(NEW);
    expect(encodeFlags(flagged)).toBe("0:person,2:private_text,3:person_private_text");
    expect(decodeFlags(encodeFlags(flagged))).toEqual(flagged);
    expect(decodeFlags("2,0")).toEqual([{ slot: 0, reason: "general" }, { slot: 2, reason: "general" }]);
    expect(decodeFlags("1:wat, x, 4:unreadable,")).toEqual([{ slot: 1, reason: "general" }, { slot: 4, reason: "unreadable" }]);
    expect(decodeFlags(undefined)).toEqual([]);
  });

  it("reads only the whole-set issues it knows", () => {
    expect(decodeIssue("too_few_objects")).toBe("too_few_objects");
    expect(decodeIssue("didnt_come_together")).toBe("didnt_come_together");
    expect(decodeIssue("nope")).toBeNull();
    expect(decodeIssue(undefined)).toBeNull();
  });
});

describe("describeFailure", () => {
  it("names each flagged photo with its reason on a privacy failure", () => {
    const copy = describeFailure(job("person_or_sensitive", "photo position(s): 0, 2. Retake those photos. Reasons: 0=person; 2=private_text."));
    expect(copy.plates).toEqual([0, 2]);
    expect(copy.flagged).toEqual([{ slot: 0, reason: "person" }, { slot: 2, reason: "private_text" }]);
    expect(copy.issue).toBeNull();
  });

  it("flags the unreadable photo when the error names it, or notes the whole set when it doesn't", () => {
    const named = describeFailure(job("photo_unavailable", "photo position 3 could not be downloaded (HTTP 404)"));
    expect(named.flagged).toEqual([{ slot: 3, reason: "unreadable" }]);
    expect(named.plates).toEqual([3]);
    expect(named.issue).toBeNull();
    const unnamed = describeFailure(job("photos_too_large", "The photos are too large to send together; re-encode them."));
    expect(unnamed.flagged).toEqual([]);
    expect(unnamed.issue).toBe("photo_missing");
  });

  it("says a failure about the whole set as an issue", () => {
    expect(describeFailure(job("too_few_objects")).issue).toBe("too_few_objects");
    expect(describeFailure(job("invalid_after_repair")).issue).toBe("didnt_come_together");
    expect(describeFailure(job("spend_cap")).issue).toBe("didnt_come_together");
    expect(describeFailure(job("provider_blocked")).issue).toBe("couldnt_use");
    expect(describeFailure(job("provider_timeout")).issue).toBeNull();
  });

  it("asks for specific retakes on a privacy failure", () => {
    const copy = describeFailure(job("person_or_sensitive", "... photo position(s): 1."));
    expect(copy.action).toBe("retake");
    expect(copy.plates).toEqual([1]);
  });

  it("asks for closer views when too few objects were found", () => {
    expect(describeFailure(job("too_few_objects")).action).toBe("retake");
  });

  it("offers a retry for transient failures", () => {
    for (const code of ["provider_timeout", "provider_rate_limited", "generation_timeout", "model_output_invalid"]) {
      expect(describeFailure(job(code)).action).toBe("retry");
    }
  });

  it("never shows operator detail for configuration problems or unknown codes", () => {
    for (const code of ["provider_not_configured", "invalid_input", "something_new", null]) {
      const copy = describeFailure(job(code, "AI_PROVIDER_API_KEY missing"));
      expect(copy.action).toBe("later");
      expect(copy.body).not.toMatch(/API|KEY|provider/i);
    }
  });
});

describe("failure copy in plain language (round 4)", () => {
  it("says photos and build, never plates, develop, the darkroom or AI", () => {
    const codes = ["person_or_sensitive", "too_few_objects", "photo_unavailable", "photos_too_large", "invalid_after_repair",
      "spend_cap", "provider_blocked", "provider_timeout", "internal_error", "provider_not_configured", null];
    for (const code of codes) {
      const { title, body } = describeFailure(job(code, "photo position(s): 0."));
      expect(`${title} ${body}`).not.toMatch(/plate|develop|darkroom|\bAI\b|model/i);
    }
  });
});
