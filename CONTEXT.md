# hggp image renderer

Turns hggp build notation (the 2D/3D Minecraft-build notation of #>>+ v2) into a 3D voxel view. This file defines the words the project uses for the notation's layout and axes.

## Language

**Module**:
A `---`-delimited legend of glyph definitions. Its definitions leak into every model that follows, until a later module rebinds a glyph.
_Avoid_: image module (that is a **Model**), legend

**Model**:
A `[[ ]]` block of cells that depicts a language element. Nested `[[ ]]` blocks make a 3D model.
_Avoid_: image module (accepted as an alias in conversation), image, block model

**Row**:
One line of cells in a model.
_Avoid_: using "row" for a direction; see **Row-axis**

**Slice**:
One 2D grid inside a model. A 2D model has one slice. A 3D model has one slice for each nested `[[ ]]`.

### Axes

**Text axis**:
One of the three directions in which a model is laid out on the page: **Row-axis**, **Column-axis**, **Slice-axis**.

**Row-axis**:
The text axis along a row, left to right.
_Avoid_: horizontal, X

**Column-axis**:
The text axis across rows, top to bottom.
_Avoid_: vertical, Y

**Slice-axis**:
The text axis across the nested slices of a 3D model, in nesting order.
_Avoid_: depth, Z

**World axis**:
One of X, Y, Z, T. X, Y and Z are Minecraft's own axes (X east, Y up, Z south). T is time and is reserved for later.

**Direction spec**:
A `<(/…/)>` modifier on one model that assigns each world axis a signed text axis, or `_` for unused. A model without one gets the default for its nesting depth.
_Avoid_: orientation, axis map

**Unused**:
A world axis that the direction spec marks `_` or leaves out. It has size 1 at coordinate 0.
