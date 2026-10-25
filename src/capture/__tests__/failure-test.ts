import { describeFailure, flaggedPlates } from "../failure";

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

describe("describeFailure", () => {
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
