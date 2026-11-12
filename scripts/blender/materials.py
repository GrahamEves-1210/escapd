# Escapd's material shelf: procedural Cycles materials (no image textures, nothing
# downloaded), each a function with a few parameters that returns a material.
# Colours are linear RGB. Textures run in object space, so a grain or a brushing
# follows the object when it's turned; `scale` is "how big is the object": pass
# the prop's size in units if it isn't about 2.
#
#   import materials as M
#   kit.assign(obj, M.brass(age=0.6))
#
# Shelf: brass, steel, silver, walnut, ebony, glass, gel, enamel, felt, paper,
# leather, wax, ceramic, flame, glow, rubber, ink. `python swatches.py` renders them all.
import math

import bpy

# ---------------------------------------------------------------- node plumbing


class Tree:
    """A material's node tree with one-line node helpers."""

    def __init__(self, name):
        self.mat = bpy.data.materials.new(name)
        self.mat.use_nodes = True
        self.nt = self.mat.node_tree
        self.nt.nodes.clear()
        self.out = self.nt.nodes.new("ShaderNodeOutputMaterial")
        self._co = None

    def node(self, kind, **props):
        n = self.nt.nodes.new(kind)
        for k, v in props.items():
            setattr(n, k, v)
        return n

    def link(self, a, b):
        self.nt.links.new(a, b)

    def set(self, socket, value):
        """Plug a socket (output) or set a constant on an input."""
        if isinstance(value, bpy.types.NodeSocket):
            self.link(value, socket)
        elif isinstance(value, (int, float)):
            socket.default_value = value
        else:
            v = tuple(value)
            socket.default_value = v + (1.0,) if len(v) == 3 and len(socket.default_value) == 4 else v

    def principled(self, **inputs):
        b = self.node("ShaderNodeBsdfPrincipled")
        for k, v in inputs.items():
            self.set(b.inputs[k], v)
        return b

    def surface(self, shader):
        self.link(shader if isinstance(shader, bpy.types.NodeSocket) else shader.outputs[0], self.out.inputs["Surface"])
        return self.mat

    def coords(self, scale=(1, 1, 1), kind="Object", rotation=(0, 0, 0)):
        tc = self.node("ShaderNodeTexCoord")
        mp = self.node("ShaderNodeMapping")
        mp.inputs["Scale"].default_value = scale
        mp.inputs["Rotation"].default_value = rotation
        self.link(tc.outputs[kind], mp.inputs["Vector"])
        return mp.outputs["Vector"]

    def noise(self, vector, scale=5.0, detail=3.0, rough=0.5, distortion=0.0, color=False):
        n = self.node("ShaderNodeTexNoise")
        self.link(vector, n.inputs["Vector"])
        n.inputs["Scale"].default_value = scale
        n.inputs["Detail"].default_value = detail
        n.inputs["Roughness"].default_value = rough
        n.inputs["Distortion"].default_value = distortion
        return n.outputs["Color" if color else "Fac"]

    def ramp(self, fac, stops, interpolation="LINEAR"):
        """stops: [(position, colour or grey), ...]"""
        r = self.node("ShaderNodeValToRGB")
        cr = r.color_ramp
        cr.interpolation = interpolation
        while len(cr.elements) < len(stops):
            cr.elements.new(0.5)
        for el, (pos, col) in zip(cr.elements, stops):
            el.position = pos
            el.color = (col, col, col, 1) if isinstance(col, (int, float)) else tuple(col)[:3] + (1,)
        self.set(r.inputs["Fac"], fac)
        return r.outputs["Color"]

    def mix(self, fac, a, b, blend="MIX"):
        m = self.node("ShaderNodeMix", data_type="RGBA", blend_type=blend)
        self.set(m.inputs[0], fac)
        self.set(m.inputs[6], a)
        self.set(m.inputs[7], b)
        return m.outputs[2]

    def math(self, op, a, b=None, clamp=False):
        m = self.node("ShaderNodeMath", operation=op, use_clamp=clamp)
        self.set(m.inputs[0], a)
        if b is not None:
            self.set(m.inputs[1], b)
        return m.outputs[0]

    def bump(self, height, strength=0.3, distance=0.01, normal=None):
        b = self.node("ShaderNodeBump")
        self.set(b.inputs["Height"], height)
        b.inputs["Strength"].default_value = strength
        b.inputs["Distance"].default_value = distance
        if normal is not None:
            self.link(normal, b.inputs["Normal"])
        return b.outputs["Normal"]

    def edges(self, lo=0.48, hi=0.62):
        """0 in the flats .. 1 on convex edges (needs a reasonably dense mesh): where hands and time wear things."""
        g = self.node("ShaderNodeNewGeometry")
        return self.ramp(g.outputs["Pointiness"], [(lo, 0.0), (hi, 1.0)])

    def facing(self, blend=0.5):
        """0 facing the camera .. 1 at grazing angles."""
        lw = self.node("ShaderNodeLayerWeight")
        lw.inputs["Blend"].default_value = blend
        return lw.outputs["Facing"]


def _axis_scale(axis, along, across):
    """A Mapping scale that stretches a texture along an axis (grain) or across it (lathe rings)."""
    return {"X": (along, across, across), "Y": (across, along, across), "Z": (across, across, along)}[axis.upper()]


def _dim(c, k):
    return tuple(max(0.0, x * k) for x in c[:3])


# ---------------------------------------------------------------- metals


def brass(name="brass", color=(0.66, 0.42, 0.15), age=0.5, brushed=0.5, wear=0.5, rough=0.30, axis="Z", scale=1.0):
    """Aged brass: a warm gold that has gone a little brown in the hollows, bright where
    it's been handled (edges), with fine lathe-brushing round `axis`.
    age 0 = fresh off the lathe .. 1 = an attic find. brushed 0 = polished .. 1 = satin."""
    t = Tree(name)
    # Tarnish: big soft patches, darker and redder.
    patches = t.noise(t.coords((1.3 / scale,) * 3), scale=1.6, detail=4, rough=0.6)
    tarnish = t.ramp(patches, [(0.35, 0.0), (0.72, 1.0)])
    dark = (color[0] * 0.42, color[1] * 0.30, color[2] * 0.22)
    base = t.mix(t.math("MULTIPLY", tarnish, 0.75 * age), color, dark)
    # Wear: polished, paler metal on the edges.
    edge = t.edges()
    bright = (min(1, color[0] * 1.22), min(1, color[1] * 1.38), min(1, color[2] * 1.9))
    base = t.mix(t.math("MULTIPLY", edge, 0.8 * wear), base, bright)
    # Brushing: fine rings round the axis (noise stretched thin along it).
    rings = t.noise(t.coords(_axis_scale(axis, 260 / scale, 1.2 / scale)), scale=1.0, detail=2, rough=0.6)
    r = t.math("ADD", rough * (0.75 + 0.5 * brushed), t.math("MULTIPLY", t.math("SUBTRACT", rings, 0.5), 0.34 * brushed))
    r = t.math("ADD", r, t.math("MULTIPLY", tarnish, 0.22 * age))
    r = t.math("SUBTRACT", r, t.math("MULTIPLY", edge, 0.12 * wear), clamp=True)
    normal = t.bump(rings, strength=0.06 * brushed, distance=0.004)
    b = t.principled(**{"Base Color": base, "Metallic": 1.0, "Roughness": r, "Normal": normal,
                        "Anisotropic": 0.35 * brushed, "Specular Tint": (1.0, 0.86, 0.6)})
    return t.surface(b)


def steel(name="steel", color=(0.10, 0.12, 0.17), blue=0.7, rough=0.34, brushed=0.4, wear=0.5, edge=(0.55, 0.56, 0.58), axis="Z", scale=1.0):
    """Blued / dark steel (a revolver's frame, a lock's bolt, a blackened torch): near-black
    with a blue cast, bare metal showing through on the edges (`edge`: grey steel, or
    brass for blackened brass). blue 0 = plain gunmetal."""
    t = Tree(name)
    grey = (0.20, 0.20, 0.21)
    col = tuple(grey[i] * 0.5 * (1 - blue) + color[i] * blue for i in range(3))
    patches = t.noise(t.coords((2.0 / scale,) * 3), scale=2.0, detail=3)
    base = t.mix(t.math("MULTIPLY", patches, 0.35), col, _dim(col, 0.6))
    base = t.mix(t.math("MULTIPLY", t.edges(), 0.85 * wear), base, edge)
    rings = t.noise(t.coords(_axis_scale(axis, 220 / scale, 1.2 / scale)), scale=1.0, detail=2)
    r = t.math("ADD", rough, t.math("MULTIPLY", t.math("SUBTRACT", rings, 0.5), 0.28 * brushed), clamp=True)
    b = t.principled(**{"Base Color": base, "Metallic": 1.0, "Roughness": r,
                        "Normal": t.bump(rings, strength=0.05 * brushed, distance=0.004)})
    return t.surface(b)


def silver(name="silver", color=(0.92, 0.90, 0.86), rough=0.08, tarnish=0.2, scale=1.0):
    """Silvered / nickel-plated metal (a torch's reflector, a mirror's back, a spoon)."""
    t = Tree(name)
    patches = t.noise(t.coords((3.0 / scale,) * 3), scale=2.5, detail=4)
    base = t.mix(t.math("MULTIPLY", patches, 0.5 * tarnish), color, (0.55, 0.47, 0.36))
    r = t.math("ADD", rough, t.math("MULTIPLY", patches, 0.25 * tarnish))
    return t.surface(t.principled(**{"Base Color": base, "Metallic": 1.0, "Roughness": r}))


# ---------------------------------------------------------------- wood


def _wood(t, axis, scale, dark, light, ring_scale, streak, pores):
    # Rings round the axis, warped; long fibres along it.
    along = _axis_scale(axis, 0.16 / scale, 1.0 / scale)
    co = t.coords(along)
    warp = t.noise(co, scale=1.4, detail=3, rough=0.55, color=True)
    co2 = t.node("ShaderNodeVectorMath", operation="ADD")
    t.link(co, co2.inputs[0])
    sc = t.node("ShaderNodeVectorMath", operation="SCALE")
    t.link(warp, sc.inputs[0])
    sc.inputs["Scale"].default_value = 0.55
    t.link(sc.outputs[0], co2.inputs[1])
    rings = t.node("ShaderNodeTexWave", wave_type="RINGS", rings_direction=axis.upper(), wave_profile="SAW")
    t.link(co2.outputs[0], rings.inputs["Vector"])
    rings.inputs["Scale"].default_value = ring_scale
    rings.inputs["Distortion"].default_value = 2.2
    rings.inputs["Detail"].default_value = 2.0
    rings.inputs["Detail Scale"].default_value = 1.2
    fibres = t.noise(t.coords(_axis_scale(axis, 1.2 / scale, 60 / scale)), scale=1.0, detail=4, rough=0.7)
    g = t.math("ADD", t.math("MULTIPLY", rings.outputs["Fac"], 1.0 - streak), t.math("MULTIPLY", fibres, streak))
    col = t.ramp(g, [(0.0, dark), (0.45, tuple((d + l) / 2 for d, l in zip(dark, light))), (1.0, light)])
    pore = t.ramp(t.noise(t.coords(_axis_scale(axis, 4 / scale, 160 / scale)), scale=1.0, detail=1), [(0.62, 0.0), (0.7, 1.0)])
    col = t.mix(t.math("MULTIPLY", pore, pores), col, _dim(dark, 0.5))
    return col, g, pore


def walnut(name="walnut", axis="Z", color=(0.21, 0.085, 0.035), figure=0.6, gloss=0.5, wear=0.4, scale=1.0):
    """Oiled walnut: dark chocolate with warmer streaks, the grain running along `axis`,
    a soft sheen rather than varnish. figure = how strong the grain. gloss 0 = dry .. 1 = French polish."""
    t = Tree(name)
    dark = _dim(color, 1.0 - 0.62 * figure)
    light = (min(1, color[0] * (1 + 1.1 * figure)), min(1, color[1] * (1 + 1.0 * figure)), min(1, color[2] * (1 + 0.8 * figure)))
    col, g, pore = _wood(t, axis, scale, dark, light, ring_scale=3.2, streak=0.45, pores=0.5)
    edge = t.edges()
    col = t.mix(t.math("MULTIPLY", edge, 0.45 * wear), col, (0.42, 0.24, 0.12))
    r = t.math("ADD", 0.62 - 0.36 * gloss, t.math("MULTIPLY", g, 0.12))
    b = t.principled(**{"Base Color": col, "Roughness": r, "Coat Weight": 0.25 + 0.6 * gloss, "Coat Roughness": 0.32 - 0.2 * gloss,
                        "Normal": t.bump(t.math("SUBTRACT", g, t.math("MULTIPLY", pore, 0.6)), strength=0.12, distance=0.004)})
    return t.surface(b)


def ebony(name="ebony", axis="Z", color=(0.030, 0.022, 0.022), gloss=0.7, scale=1.0):
    """Ebony / ebonised wood: near-black with a faint brown grain and a deep polish."""
    t = Tree(name)
    col, g, pore = _wood(t, axis, scale, _dim(color, 0.6), (color[0] * 2.6, color[1] * 2.0, color[2] * 1.6), ring_scale=4.0, streak=0.7, pores=0.3)
    edge = t.edges()
    col = t.mix(t.math("MULTIPLY", edge, 0.25), col, (0.16, 0.10, 0.07))
    b = t.principled(**{"Base Color": col, "Roughness": 0.5 - 0.28 * gloss, "Coat Weight": 0.3 + 0.6 * gloss, "Coat Roughness": 0.12,
                        "Normal": t.bump(g, strength=0.06, distance=0.003)})
    return t.surface(b)


# ---------------------------------------------------------------- glass and light


def glass(name="glass", tint=(0.90, 0.96, 0.98), ior=1.45, rough=0.0, haze=0.03, rim=0.4, radius=None, axis="Z", density=0.0):
    """Lens / window glass. On transparent film (kit.setup(transparent_glass=True),
    kit.render(exr=True), export.lift_glass()) the middle stays see-through, with the
    window's highlight (kit.window) and a paler, denser rim where a real lens gathers
    light. haze = how much the glass itself shows in the middle (dust, thickness);
    rim = how much more at its edge. radius: the lens's radius about `axis` (object
    space): the rim then follows the lens's edge; without it, the rim is wherever the
    surface turns away from the viewer (bottles, domes, marbles).
    ior: real glass is 1.5, which mirrors about a tenth of the room and greys whatever
    shows through; for a lens that must look clear over the game use about 1.28 and a
    brighter kit.window.
    tint colours the haze and the rim. density (0..1) also colours what shows through
    (bottle glass, Wood's glass): on transparent film that reads as a grey veil, since
    a darker pane is a more opaque one, so leave it at 0 for anything see-through.
    (The haze is light the glass gives off, added to a pure Glass BSDF: mixing an
    opaque shader into glass makes Cycles count the whole pane as solid in the alpha.)"""
    t = Tree(name)
    g = t.node("ShaderNodeBsdfGlass")
    t.set(g.inputs["Color"], tuple(1 - (1 - c) * density for c in tint))
    g.inputs["IOR"].default_value = ior
    g.inputs["Roughness"].default_value = rough
    if radius:
        tc = t.node("ShaderNodeTexCoord")
        flat = t.node("ShaderNodeVectorMath", operation="MULTIPLY")
        flat.inputs[1].default_value = {"X": (0, 1, 1), "Y": (1, 0, 1), "Z": (1, 1, 0)}[axis.upper()]
        ln = t.node("ShaderNodeVectorMath", operation="LENGTH")
        t.link(tc.outputs["Object"], flat.inputs[0])
        t.link(flat.outputs[0], ln.inputs[0])
        mr = t.node("ShaderNodeMapRange", interpolation_type="SMOOTHERSTEP")
        mr.inputs["From Min"].default_value, mr.inputs["From Max"].default_value = radius * 0.66, radius
        t.link(ln.outputs["Value"], mr.inputs["Value"])
        edge = t.math("POWER", mr.outputs[0], 2.0)
    else:
        edge = t.math("POWER", t.facing(0.4), 2.0)
    amount = t.math("ADD", haze, t.math("MULTIPLY", edge, rim), clamp=True)
    e = t.node("ShaderNodeEmission")
    t.set(e.inputs["Color"], tint)
    t.link(amount, e.inputs["Strength"])
    a = t.node("ShaderNodeAddShader")
    t.link(g.outputs[0], a.inputs[0])
    t.link(e.outputs[0], a.inputs[1])
    return t.surface(a)


def gel(name="gel", color=(0.85, 0.04, 0.05), rough=0.25, density=0.8):
    """A coloured lighting gel / stained glass / a ruby lens: light passes through and takes
    the colour. density 0 = barely tinted .. 1 = deep."""
    t = Tree(name)
    col = tuple(1 - (1 - c) * density for c in color)
    b = t.principled(**{"Base Color": col, "Transmission Weight": 1.0, "Roughness": rough, "IOR": 1.45,
                        "Coat Weight": 0.5, "Coat Roughness": 0.1})
    return t.surface(b)


def glow(name="glow", color=(1.0, 0.72, 0.36), strength=6.0, falloff=0.0):
    """Something that gives light (a bulb, a lit lens, a UV tube, an ember). falloff > 0
    dims it toward its edges (a hot core)."""
    t = Tree(name)
    e = t.node("ShaderNodeEmission")
    t.set(e.inputs["Color"], color)
    if falloff > 0:
        s = t.math("MULTIPLY", strength, t.math("POWER", t.math("SUBTRACT", 1.0, t.facing(0.5)), 1.0 + 4.0 * falloff))
        t.link(s, e.inputs["Strength"])
    else:
        e.inputs["Strength"].default_value = strength
    return t.surface(e)


def lit(material, color=(1.0, 0.72, 0.36), strength=1.0, radial=None, edge=0.25):
    """Make any Principled material give off light as well (a reflector behind a lit bulb,
    a hot coal, a glowing dial). radial=(r0, r1): full strength within r0 of the object's
    Z axis, falling to `edge` of it by r1 (a hot middle). Returns the material."""
    nt = material.node_tree
    for n in nt.nodes:
        if n.type == "BSDF_PRINCIPLED":
            n.inputs["Emission Color"].default_value = tuple(color) + (1.0,)
            n.inputs["Emission Strength"].default_value = strength
            if radial:
                tc = nt.nodes.new("ShaderNodeTexCoord")
                flat = nt.nodes.new("ShaderNodeVectorMath")
                flat.operation = "MULTIPLY"
                flat.inputs[1].default_value = (1, 1, 0)
                ln = nt.nodes.new("ShaderNodeVectorMath")
                ln.operation = "LENGTH"
                mr = nt.nodes.new("ShaderNodeMapRange")
                mr.interpolation_type = "SMOOTHSTEP"
                mr.inputs["From Min"].default_value, mr.inputs["From Max"].default_value = radial
                mr.inputs["To Min"].default_value, mr.inputs["To Max"].default_value = strength, strength * edge
                nt.links.new(tc.outputs["Object"], flat.inputs[0])
                nt.links.new(flat.outputs[0], ln.inputs[0])
                nt.links.new(ln.outputs["Value"], mr.inputs["Value"])
                nt.links.new(mr.outputs[0], n.inputs["Emission Strength"])
    return material


def flame(name="flame", strength=2.4, axis="Z", height=1.0, base=0.0, color=(1.0, 0.56, 0.12)):
    """A candle flame for a teardrop mesh: blue at the wick, a hot pale core, orange
    toward the tip, thinning to nothing at its edges (so it sits on any background).
    `base` and `height` say where the flame starts and how tall it is along `axis` (object space)."""
    t = Tree(name)
    tc = t.node("ShaderNodeTexCoord")
    sep = t.node("ShaderNodeSeparateXYZ")
    t.link(tc.outputs["Object"], sep.inputs[0])
    h = t.math("DIVIDE", t.math("SUBTRACT", sep.outputs[axis.upper()], base), height, clamp=True)
    col = t.ramp(h, [(0.0, (0.10, 0.22, 0.9)), (0.14, (0.55, 0.45, 0.75)), (0.3, (1.0, 0.86, 0.55)), (0.62, color), (1.0, _dim(color, 0.7))])
    core = t.math("SUBTRACT", 1.0, t.facing(0.5))
    e = t.node("ShaderNodeEmission")
    t.link(col, e.inputs["Color"])
    t.link(t.math("MULTIPLY", strength, t.math("ADD", 0.35, t.math("POWER", core, 1.5))), e.inputs["Strength"])
    tr = t.node("ShaderNodeBsdfTransparent")
    alpha = t.math("MULTIPLY", t.ramp(core, [(0.08, 0.0), (0.55, 1.0)]), t.ramp(h, [(0.0, 0.55), (0.2, 1.0), (0.85, 1.0), (1.0, 0.0)]))
    m = t.node("ShaderNodeMixShader")
    t.link(alpha, m.inputs[0])
    t.link(tr.outputs[0], m.inputs[1])
    t.link(e.outputs[0], m.inputs[2])
    return t.surface(m)


# ---------------------------------------------------------------- paint, cloth, paper, skin


def enamel(name="enamel", color=(0.55, 0.04, 0.07), gloss=0.9, chips=0.0, scale=1.0):
    """Vitreous enamel / lacquer (pins, a tin sign, a kettle): a flat, dense colour under
    a glossy coat. chips > 0 flakes it back to dark metal on the edges."""
    t = Tree(name)
    col = color
    kw = {}
    if chips > 0:
        edge = t.edges(0.5, 0.6)
        n = t.ramp(t.noise(t.coords((14 / scale,) * 3), scale=1.0, detail=4), [(0.45, 0.0), (0.55, 1.0)])
        chip = t.math("MULTIPLY", t.math("MULTIPLY", edge, n), chips, clamp=True)
        col = t.mix(chip, color, (0.05, 0.045, 0.045))
        kw["Metallic"] = chip
    b = t.principled(**{"Base Color": col, "Roughness": 0.42, "Coat Weight": gloss, "Coat Roughness": 0.06, "Coat IOR": 1.6, **kw})
    return t.surface(b)


def felt(name="felt", color=(0.07, 0.20, 0.11), nap=0.6, scale=1.0):
    """Felt / baize / velvet (a drawer's lining, a jeweller's tray): no shine, a soft
    bloom at grazing angles, a tiny fibre texture. nap 0 = flat felt .. 1 = deep velvet."""
    t = Tree(name)
    fib = t.noise(t.coords((90 / scale,) * 3), scale=1.0, detail=3, rough=0.8)
    mottle = t.noise(t.coords((5 / scale,) * 3), scale=1.0, detail=2)
    col = t.mix(t.math("MULTIPLY", mottle, 0.35), color, _dim(color, 0.6))
    col = t.mix(t.math("MULTIPLY", fib, 0.25), col, _dim(color, 1.5))
    b = t.principled(**{"Base Color": col, "Roughness": 1.0, "Specular IOR Level": 0.05,
                        "Sheen Weight": 0.5 + 0.5 * nap, "Sheen Roughness": 0.45, "Sheen Tint": tuple(min(1, c * 3 + 0.25) for c in color),
                        "Normal": t.bump(fib, strength=0.5, distance=0.003)})
    return t.surface(b)


def paper(name="paper", color=(0.86, 0.79, 0.66), fibre=0.5, age=0.3, scale=1.0):
    """Paper / card (letters, tags, labels, playing cards): warm cream, a slight fibre,
    foxed a little with `age`. Matte. Give thin sheets a solidify so they catch a rim."""
    t = Tree(name)
    fib = t.noise(t.coords((70 / scale, 70 / scale, 70 / scale)), scale=1.0, detail=5, rough=0.75)
    blot = t.noise(t.coords((2.2 / scale,) * 3), scale=1.0, detail=4, rough=0.6)
    col = t.mix(t.math("MULTIPLY", t.math("SUBTRACT", fib, 0.3), 0.3 * fibre, clamp=True), color, _dim(color, 0.78))
    col = t.mix(t.math("MULTIPLY", t.ramp(blot, [(0.45, 0.0), (0.8, 1.0)]), 0.6 * age), col, (color[0] * 0.78, color[1] * 0.62, color[2] * 0.42))
    b = t.principled(**{"Base Color": col, "Roughness": 0.9, "Specular IOR Level": 0.15, "Sheen Weight": 0.15,
                        "Normal": t.bump(fib, strength=0.25 * fibre, distance=0.002)})
    return t.surface(b)


def leather(name="leather", color=(0.20, 0.07, 0.035), grain=0.6, wear=0.5, scale=1.0):
    """Leather (a casebook's cover, a strap, a chair): pebbled grain, a dull waxy sheen,
    paler where it's rubbed (edges)."""
    t = Tree(name)
    v = t.node("ShaderNodeTexVoronoi", feature="DISTANCE_TO_EDGE")
    t.link(t.coords((38 / scale,) * 3), v.inputs["Vector"])
    v.inputs["Scale"].default_value = 1.0
    cells = t.ramp(v.outputs["Distance"], [(0.0, 0.0), (0.12, 1.0)])
    mottle = t.noise(t.coords((3 / scale,) * 3), scale=1.0, detail=4)
    col = t.mix(t.math("MULTIPLY", mottle, 0.5), color, _dim(color, 0.55))
    col = t.mix(t.math("MULTIPLY", t.math("SUBTRACT", 1.0, cells), 0.5), col, _dim(color, 0.4))
    edge = t.edges()
    col = t.mix(t.math("MULTIPLY", edge, 0.6 * wear), col, tuple(min(1, c * 2.4 + 0.05) for c in color))
    b = t.principled(**{"Base Color": col, "Roughness": t.math("ADD", 0.42, t.math("MULTIPLY", mottle, 0.2)),
                        "Coat Weight": 0.15, "Coat Roughness": 0.4,
                        "Normal": t.bump(cells, strength=0.35 * grain, distance=0.004)})
    return t.surface(b)


def wax(name="wax", color=(0.86, 0.78, 0.62), translucency=0.6, gloss=0.4):
    """Candle wax / sealing wax: light gets a little way in (soft, glowing edges)."""
    t = Tree(name)
    b = t.principled(**{"Base Color": color, "Roughness": 0.55 - 0.3 * gloss, "Subsurface Weight": translucency,
                        "Subsurface Radius": (0.12, 0.07, 0.04), "Subsurface Scale": 0.5,
                        "Coat Weight": 0.3 * gloss, "Coat Roughness": 0.2})
    return t.surface(b)


def ceramic(name="ceramic", color=(0.85, 0.82, 0.74), glaze=0.9, speckle=0.2, scale=1.0):
    """Glazed ceramic / porcelain (a mug, a teapot, a tile, a doorknob): a thick glassy
    glaze over a slightly uneven body, the odd iron speckle."""
    t = Tree(name)
    pool = t.noise(t.coords((1.6 / scale,) * 3), scale=1.0, detail=2)
    col = t.mix(t.math("MULTIPLY", pool, 0.25), color, _dim(color, 0.8))
    dots = t.ramp(t.noise(t.coords((60 / scale,) * 3), scale=1.0, detail=1), [(0.72, 0.0), (0.76, 1.0)])
    col = t.mix(t.math("MULTIPLY", dots, speckle), col, (0.16, 0.09, 0.05))
    b = t.principled(**{"Base Color": col, "Roughness": 0.5, "Coat Weight": glaze, "Coat Roughness": 0.04, "Coat IOR": 1.55,
                        "Subsurface Weight": 0.08, "Subsurface Radius": (0.05, 0.03, 0.02),
                        "Normal": t.bump(pool, strength=0.04, distance=0.02)})
    return t.surface(b)


def rubber(name="rubber", color=(0.030, 0.028, 0.030), rough=0.75, dust=0.3, scale=1.0):
    """Rubber / bakelite / vulcanite (a torch's switch boot, a stamp's handle, a tyre):
    dull, dark, a little dusty in the hollows."""
    t = Tree(name)
    n = t.noise(t.coords((40 / scale,) * 3), scale=1.0, detail=3)
    col = t.mix(t.math("MULTIPLY", n, 0.5 * dust), color, tuple(min(1, c * 2.5 + 0.03) for c in color))
    b = t.principled(**{"Base Color": col, "Roughness": rough, "Specular IOR Level": 0.35,
                        "Normal": t.bump(n, strength=0.15, distance=0.002)})
    return t.surface(b)


def ink(name="ink", color=(0.016, 0.010, 0.018)):
    """Flat ink (engraved marks, painted numerals, a silhouette): no shading at all."""
    t = Tree(name)
    e = t.node("ShaderNodeEmission")
    t.set(e.inputs["Color"], color)
    e.inputs["Strength"].default_value = 1.0
    return t.surface(e)


def toon(name="toon", color=(0.78, 0.47, 0.14), shadow=None, light=None, steps=3):
    """Flat, banded shading (the kit's "painterly" trial; not the house look, kept for
    comparisons and for deliberately graphic props)."""
    t = Tree(name)
    shadow = shadow or _dim(color, 0.22)
    light = light or tuple(min(1, c * 1.5 + 0.12) for c in color)
    # The studio is bright (it lights metal): bring the bands back to the flat colours asked for.
    color, light = _dim(color, 0.16), _dim(light, 0.05)
    # Cycles has no Shader-to-RGB: band the diffuse and gloss lobes themselves.
    td = t.node("ShaderNodeBsdfToon", component="DIFFUSE")
    t.set(td.inputs["Color"], color)
    td.inputs["Size"].default_value = 0.62
    td.inputs["Smooth"].default_value = 0.04
    tg = t.node("ShaderNodeBsdfToon", component="GLOSSY")
    t.set(tg.inputs["Color"], light)
    tg.inputs["Size"].default_value = 0.28
    tg.inputs["Smooth"].default_value = 0.02
    e = t.node("ShaderNodeEmission")
    t.set(e.inputs["Color"], shadow)
    e.inputs["Strength"].default_value = 1.0
    a = t.node("ShaderNodeAddShader")
    t.link(td.outputs[0], a.inputs[0])
    t.link(e.outputs[0], a.inputs[1])
    a2 = t.node("ShaderNodeAddShader")
    t.link(a.outputs[0], a2.inputs[0])
    t.link(tg.outputs[0], a2.inputs[1])
    return t.surface(a2)
