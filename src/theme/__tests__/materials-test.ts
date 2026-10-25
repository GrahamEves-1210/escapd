import { compartmentFor } from "../materials";

describe("compartmentFor", () => {
  it("lines the drawer from the object's name", () => {
    expect(compartmentFor("desk drawer").id).toBe("walnut_baize");
    expect(compartmentFor("bookshelf").id).toBe("walnut_baize");
    expect(compartmentFor("wall safe").id).toBe("riveted_gunmetal");
    expect(compartmentFor("door").rivets).toBe(true);
    expect(compartmentFor("torn note").id).toBe("manila_dossier");
    expect(compartmentFor("rug").id).toBe("woven_linen");
    expect(compartmentFor("lamp").id).toBe("slate_specimen");
    expect(compartmentFor(undefined).id).toBe("slate_specimen");
  });
});
