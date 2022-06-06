# matcap-studio

https://www.kchapelier.com/matcap-studio/

An utility to tweak matcaps, with realtime visual feedback.

The main objective of this project is to have a free, fast and (relatively) simple way for developers and designers to tweak their matcaps while having a direct feedback.

## How to use

 - Drag and drop matcap files, png and jpg files are currently supported.
 - Drag and drop any model you want to specifically test the matcap on, obj, prwm and self-contained gltf/glb files are supported.
 - Press H to hide the GUI.
 - Press X to expand / close all the controls.
 - The output of the tool is currently limited to 512x512 png files.

## Technical notes

The view of the 3D model is implemented with Three.js.

The matcap processing is done in vanilla WebGL2 in two passes. The intermediate render between the two passes is encoded as a 512x512 RGBA32F texture.

## How to report an issue ?

Either create an issue on Github or contact me on [Twitter](https://twitter.com/kchplr). Please provide the following information when applicable :

 - Your config (browser, browser version, OS and graphic card)
 - A screenshot of the issue (if it is a graphical bug)

## How to contribute ?

Make sure to contact me, either on [Twitter](https://twitter.com/kchplr) or through an issue on Github, so we can discuss the change(s) you'd like to make.

## History

 - **0.6.0 (2022-06-06):** Add the ability to apply fresnel rim + fix saturation and tinting overriding the hue, brightness and contrast + set default anisotropy to 8 if possible
 - **0.5.1 (2022-05-27):** Fix conflict between the curve modifier and the shadowing + properly label the torus knot 
 - **0.5.0 (2022-05-26):** Add the ability to apply a shadow on the matcap
 - **0.4.1 (2022-05-21):** Update the dependencies
 - **0.4.0 (2021-05-03):** Add contrast pivot parameter, add control over the mipmap & anisotropy filtering of the matcap in the viewer
 - **0.3.0 (2021-03-09):** Add new iridescence model, add "Reset all" button
 - **0.2.0 (2021-02-27):** Add luma bias parameter to circular blur, apply opaque color background after blur, make number of texture samples in the blur pass parameter-dependent, add hotkey to expand/close all controls
 - **0.1.2 (2021-02-25):** Better memory management, avoid redundant renders of the 3d model, simplified skybox
 - **0.1.1 (2021-02-24):** Fix minor UI issues
 - **0.1.0 (2021-02-23):** First release

 ## Links

  - [Seminal paper on Lit Spheres (aka Matcaps)](https://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.445.6888&rep=rep1&type=pdf)
  - [Documentation for the MeshMatcapMaterial in Three.js](https://threejs.org/docs/index.html#api/en/materials/MeshMatcapMaterial)
  - [Library of matcap PNG textures organized by color](https://github.com/nidorx/matcaps)