"use strict";

// TODO dispose dragged/dropped model geometry after use
// TODO change how the models are loaded to make it possible to memoize the gltf data
// TODO prevent reload of current model

const noop = function () {};

const manager = new THREE.LoadingManager();
const textureLoader = new THREE.TextureLoader(manager);
const prwmLoader = new THREE.PRWMLoader(manager);
const objLoader = new THREE.OBJLoader(manager);
const gltfLoader = new THREE.GLTFLoader(manager);

const memoizedLoadedCache = {};
const memoizedReturnedCache = {};
function memoizedLoader(loader, url, done) {
    if(memoizedLoadedCache.hasOwnProperty(url)) {
        done(memoizedLoadedCache[url]);
        return memoizedReturnedCache[url];
    } else {
        memoizedReturnedCache[url] = loader.load(url, function (data) {
            memoizedLoadedCache[url] = data;
            done(memoizedLoadedCache[url]);
        });
        return memoizedReturnedCache[url];
    }
}

function findFirstMesh(children) {
    let mesh = null;

    for (let object of children) {
        if (object.type !== 'Mesh' && object.type !== 'SkinnedMesh' && object.children && Array.isArray(object.children) && object.children.length) {
            object = findFirstMesh(object.children) || object;
        }

        if (object.type === 'Mesh' || object.type === 'SkinnedMesh') {
            mesh = object;
        }
    }

    return mesh;
}

function Viewer (viewerElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });

    this.canvasTexture = null;

    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 10000);
    this.camera.position.z = 400;

    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.2;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 20;
    this.controls.maxDistance = 3000;
    this.controls.minPolarAngle = Math.PI / 10;
    this.controls.maxPolarAngle = Math.PI / 10 * 9;

    this.controls.addEventListener('change', () => {
        this.forceRender = true;
    });

    this.scene = new THREE.Scene();
    this.material = new THREE.MeshMatcapMaterial( {
        color: 0xFFFFFF,
        matcap: this.canvasTexture,
        normalMap: null,
        normalMapType: THREE.TangentSpaceNormalMap,
        normalScale: new THREE.Vector2(1.0, 1.0)
    });

    this.torusMesh = new THREE.Mesh(new THREE.TorusKnotGeometry(100, 30, 256, 48), this.material);
    this.setMesh(this.torusMesh, null);
    this.setGlobe();
    this.resize();

    viewerElement.appendChild(this.renderer.domElement);

    this.forceRender = true;
}

Viewer.prototype.setMesh = function (newMesh, normalMap) {
    if (this.mesh !== null) {
        this.scene.remove(this.mesh);
    }

    this.mesh = newMesh;

    if (!this.mesh.geometry.attributes.hasOwnProperty('normal')) {
        this.mesh.geometry.computeVertexNormals();
    }

    if (!this.mesh.geometry.boundingSphere) {
        this.mesh.geometry.computeBoundingSphere();
    }

    const scale = 180 / this.mesh.geometry.boundingSphere.radius;

    this.mesh.position.x = -this.mesh.geometry.boundingSphere.center.x * scale;
    this.mesh.position.y = -this.mesh.geometry.boundingSphere.center.y * scale;
    this.mesh.position.z = -this.mesh.geometry.boundingSphere.center.z * scale;

    this.mesh.scale.set(scale, scale, scale);

    this.mesh.material = this.material;
    this.material.normalMap = normalMap;
    this.material.needsUpdate = true;

    this.scene.add(this.mesh);
    this.controls.reset();

    this.forceRender = true;
};

Viewer.prototype.setGlobe = function () {
    const globeGeometry = new THREE.IcosahedronGeometry(5000, 5);
    this.globeMaterial = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: {
            source: { value: null },
            resolution: { value: new THREE.Vector2(0.0, 0.0) }
        },
        vertexShader: `
            void main()	{
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            uniform sampler2D source;
            uniform vec2 resolution;

            void main()	{
                vec2 uv = gl_FragCoord.xy / resolution;

                float s = 0.12;

                vec4 bottomleft = mix(texture2D(source, vec2(0.0, 0.0)), texture2D(source, vec2(s, s)), clamp(uv.x * 2., 0., 1.));
                vec4 bottomright = mix(texture2D(source, vec2(1.0, 0.0)), texture2D(source, vec2(1. - s, s)), 1. - clamp((uv.x - 1.) * 2., 0., 1.));
                vec4 topleft = mix(texture2D(source, vec2(0.0, 1.0)), texture2D(source, vec2(s, 1. - s)), clamp(uv.x, 0., 1.));
                vec4 topright = mix(texture2D(source, vec2(1.0, 1.0)), texture2D(source, vec2(1. - s, 1. - s)), 1. - clamp(uv.x - 1., 0., 1.));

                vec4 color = mix(
                    mix(bottomleft, bottomright, uv.x),
                    mix(topleft, topright, uv.x),
                    uv.y
                );

                // https://www.shadertoy.com/view/4tfGWl
                // http://media.steampowered.com/apps/valve/2015/Alex_Vlachos_Advanced_VR_Rendering_GDC2015.pdf
                vec3 dither = vec3(dot(vec2(171., 231.), gl_FragCoord.xy));
                dither = fract(dither.rgb / vec3(103., 71., 97.)) - vec3(0.5, 0.5, 0.5);
                color.rgb = clamp(color.rgb + dither / 100., 0., 1.);

                gl_FragColor = color;
            }
        `
    });

    this.globeMesh = new THREE.Mesh(globeGeometry, this.globeMaterial);
    this.scene.add(this.globeMesh);
};

Viewer.prototype.updateTexture = function (canvas) {
    this.canvasTexture = this.canvasTexture === null ? new THREE.CanvasTexture(canvas) : this.canvasTexture;
    this.canvasTexture.needsUpdate = true;

    this.material.matcap = this.canvasTexture; 
    this.material.needsUpdate = true;

    this.globeMaterial.uniforms.source.value = this.canvasTexture;
    this.globeMaterial.needsUpdate = true;
    
    this.forceRender = true;
}

Viewer.prototype.updateViewer = function (options) {
    this.camera.fov = options.fov;
    this.camera.updateProjectionMatrix();

    this.forceRender = true;
};

Viewer.prototype.updateModel = function (fileName, data) {
    if (fileName.match(/\.prwm$/)) {
        const bufferGeometry = prwmLoader.parse(data);
        this.setMesh(new THREE.Mesh(bufferGeometry, this.material), null);
    } else if (fileName.match(/\.obj$/)) {
        const object = objLoader.parse(data);
        const mesh = findFirstMesh([object]);

        if(mesh) {
            this.setMesh(mesh, null);
        }
    } else {
        gltfLoader.parse(data, fileName, gltf => {
            const mesh = findFirstMesh(gltf.scene.children);

            if (mesh) {
                this.setMesh(mesh, null);
            }
        }, noop);
    }
};


Viewer.prototype.downloadModel = function (model, normal, done) {
    const normalMap = normal ? memoizedLoader(textureLoader, 'assets/models/' + normal, noop) : null;

    if (model.match(/\.prwm$/)) {
        memoizedLoader(prwmLoader, 'assets/models/' + model, bufferGeometry => {
            this.setMesh(new THREE.Mesh(bufferGeometry, this.material), null);
            done();
        });
    } else {
        // can't memoize glb like this because the process of adding the mesh to our scene removes it from gltf.scene
        // this will do in the meantime

        gltfLoader.load('assets/models/' + model, gltf => {
            this.setMesh(findFirstMesh(gltf.scene.children), normalMap);
            done();
        });

        /*
        memoizedLoader(gltfLoader, 'assets/models/' + model, gltf => {
            this.setMesh(findFirstMesh(gltf.scene.children), normalMap);
        });
        */
    }
}

Viewer.prototype.chooseModel = function (model, normal) {
    if (model === 'torus') {
        this.setMesh(this.torusMesh, null);
    } else {
        document.body.classList.add('loading');
        this.downloadModel(model, normal, () => {
            document.body.classList.remove('loading');
        });
    }
};

Viewer.prototype.resize = function () {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(pixelRatio);
    
    this.globeMaterial.uniforms.resolution.value.set(width * pixelRatio, height * pixelRatio);

    this.forceRender = true;
};

Viewer.prototype.update = function () {
    if (this.controls.update() || this.forceRender) {
        console.log('render');
        this.renderer.render(this.scene, this.camera);
        this.forceRender = false;
    }
};

module.exports = Viewer;