"use strict";

let matcapProgram = null;
let angularBlurProgram = null;
let workingTexture = null;

/**
 *
 * @param context
 * @returns {WorkingWebGLProgram}
 */
function getMatcapProgram (context) {
    if (matcapProgram === null) {
        matcapProgram = context.createProgram(`#version 300 es
            precision highp float;
            precision highp int;
            precision highp sampler2D;

            layout(location = 0) out vec4 fragColor;

            const int TYPE_SMOOTH = 1;
            const int TYPE_STANDARD = 0;

            const float PI2 = 6.2831853;

            uniform vec2 resolution;

            uniform float translationX;
            uniform float translationY;
            uniform float zoom;
            uniform float rotation;

            uniform float multiplier;
            uniform float add;

            uniform int type;
            uniform float brightness;
            uniform float contrast;

            uniform bool backgroundRegenerate;
            uniform vec3 backgroundColor;
            uniform float backgroundColorRatio;

            uniform float saturation;

            uniform float iridescenceAmount; // = 0.2;
            uniform float iridescencePower; // = 4.;
            uniform float iridescenceScale; // = 2.;
            uniform float iridescencePower2; // = 2.;
            uniform float lumaFactor1; // = 3.;
            uniform float lumaFactor2; // = 3.;

            uniform float hueShift; //=0
            uniform float tintAmount; //=0
            uniform vec3 tintColor; //=vec3(1.,1.,1.)
            uniform float hueChangeOnBackground; //=0

            uniform sampler2D source;
            uniform bool sourceSet;
            uniform vec2 sourceSize;

            const float eps = 0.0000001;

            vec3 rgb2hsl(vec3 color) {
                vec3 hsl = vec3(0.);

                float fmin = min(min(color.r, color.g), color.b); //Min. value of RGB
                float fmax = max(max(color.r, color.g), color.b); //Max. value of RGB
                float delta = fmax - fmin; //Delta RGB value

                hsl.z = (fmax + fmin) / 2.0; // Luminance

                if (delta == 0.0) //This is a gray, no chroma...
                {
                    hsl.x = 0.0; // Hue
                    hsl.y = 0.0; // Saturation
                } else //Chromatic data...
                {
                    if (hsl.z < 0.5)
                        hsl.y = delta / (fmax + fmin); // Saturation
                    else
                        hsl.y = delta / (2.0 - fmax - fmin); // Saturation
           
                    float deltaR = (((fmax - color.r) / 6.0) + (delta / 2.0)) / delta;
                    float deltaG = (((fmax - color.g) / 6.0) + (delta / 2.0)) / delta;
                    float deltaB = (((fmax - color.b) / 6.0) + (delta / 2.0)) / delta;
           
                    if (color.r == fmax)
                        hsl.x = deltaB - deltaG; // Hue
                    else if (color.g == fmax)
                        hsl.x = (1.0 / 3.0) + deltaR - deltaB; // Hue
                    else if (color.b == fmax)
                        hsl.x = (2.0 / 3.0) + deltaG - deltaR; // Hue
           
                    if (hsl.x < 0.0)
                        hsl.x += 1.0; // Hue
                    else if (hsl.x > 1.0)
                        hsl.x -= 1.0; // Hue
                }
           
                return hsl;
            }

            vec3 _hsl2rgb (in vec3 c) {
              vec3 rgb = clamp( abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0, 1.0 );
              return c.z + c.y * (rgb-0.5)*(1.0-abs(2.0*c.z-1.0));
            }

            vec3 _rgb2hsl (vec3 col) {
                col = clamp(col, 0., 1.);
              float minc = min( col.r, min(col.g, col.b) );
              float maxc = max( col.r, max(col.g, col.b) );
              vec3 mask = step(col.grr,col.rgb) * step(col.bbg,col.rgb);
              vec3 h = mask * (vec3(0.0,2.0,4.0) + (col.gbr-col.brg)/(maxc-minc + eps)) / 6.0;
              return vec3( fract( 1.0 + h.x + h.y + h.z ),              // H
                           (maxc-minc)/(1.0-abs(minc+maxc-1.0) + eps),  // S
                           (minc+maxc)*0.5 );                           // L
            }


            vec3 hslShift(vec3 color) {
                color = rgb2hsl(color);
                color.r = color.r + hueShift + 1.;
                return _hsl2rgb(color);
            }

            vec2 rotate(vec2 v, float a) {
                float s = sin(a);
                float c = cos(a);
                mat2 m = mat2(c, -s, s, c);
                return m * v;
            }

            float hemisphere(in vec2 cuv) {
                return min(1.0, sqrt(max(0., 1.0 - cuv.x * cuv.x - cuv.y * cuv.y)));
            }

            vec4 sampleSource(in vec2 uv) {
                vec2 scaleSource = sourceSize / min(sourceSize.x, sourceSize.y);
                vec2 nuv = rotate(uv - 0.5, rotation * PI2) / zoom / scaleSource + 0.5 - vec2(translationX, translationY) * 0.5;
                return texture(source, nuv);
            }

            vec4 process (in vec2 uv) {
                vec2 cuv = (uv - 0.5) * 2.0;

                float mask = clamp((100. - length(cuv*0.999) * 99.), 0., 1.); // used to limit some effects (iridescence and hue shift) to the inner part of the matcap

                float z = hemisphere(cuv);
                vec3 cuv3 = vec3(cuv, z);
                float h = length(cuv3.xy);
                
                cuv3.z = cuv3.z * multiplier + add;
                cuv3 = normalize(cuv3);
                
                vec4 col = vec4(0.);

                if (h > 1. && backgroundRegenerate == true) {
                    // generate outside, a totally arbitrary process

                    vec2 nuv = normalize(cuv3.xy);
                    vec2 uvb = (nuv * 0.5 + 0.5) - nuv * pow(h - 1., 1.40) * 1.;
                    vec2 uvc = (nuv * 0.5 + 0.5) - nuv * pow(h - 1., 1.35) * 0.1;
                    vec2 uva = (nuv * 0.5 + 0.5) - nuv * pow(h - 1., 1.30) * 0.05;
                    
                    col = (sampleSource(uva) + sampleSource(uvb) + sampleSource(uvc)) / 3.;
                } else {
                    col = mix(
                        sampleSource(uv),
                        sampleSource(cuv3.xy * 0.5 + 0.5),
                        1.0 - smoothstep(0.9985, 1.0035, h)
                    );
                }

                // hue shift

                col.rgb = mix(
                    col.rgb,
                    mix(hslShift(col.rgb), col.rgb, step(fract(hueShift), 0.)),
                    mix(mask, 1., hueChangeOnBackground)
                );

                // brightness and contrast

                if (type == TYPE_SMOOTH) {
                    // apply contrast
                    // very arbitrary mapping from [-1,1] to [0. (0**(1+0)), 3. (2**(1+0.5849625007))]
                    float icontrast = pow(contrast + 1., 1.0 + 0.5849625007 * pow((contrast + 1.) / 2., 4.));
                    col.rgb = (col.rgb - 0.5) * icontrast + 0.5;
                    //apply brightness
                    float midPoint = 0.5 + brightness / 4.0;
                    float range = min(abs(midPoint), abs(1. - midPoint));
                    col.rgb = mix(vec3(midPoint - range), vec3(midPoint + range), col.rgb);
                } else {
                    col.rgb = (col.rgb - 0.5) * (contrast + 1.) + brightness + 0.5;
                }

                // desaturation and tinting

                float luma = clamp(dot(col.rgb, vec3(0.299, 0.587, 0.114)), 0., 1.);

                col.rgb = mix(
                    vec3(luma),
                    col.rgb,
                    saturation
                );

                col.rgb = mix(
                    col.rgb,
                    vec3(luma) * tintColor,
                    tintAmount * mix(mask, 1., hueChangeOnBackground)
                );

                // iridescence
                
                float lz = z * mix(1., 0.2 + 0.8 * z, clamp(luma * lumaFactor1, 0., 1.));

                float iridescencePower2m = 0.01 + 0.99 * iridescencePower2;

                float nz = pow(pow(lz, 1. / iridescencePower2m), iridescencePower) * iridescenceScale;

                vec3 iridescence = mix(vec3(1.5,1., 0.1), vec3(0.1, 0.0, 1.5), clamp(nz, 0., 1.));

                float ratio = pow(clamp(1.-luma, 0., 1.), lumaFactor2) * (1. - pow(clamp(z, 0., 1.), iridescencePower2m)) * mask;
                col.rgb = mix(col.rgb, iridescence, ratio * iridescenceAmount);

                // background opaque color

                col.rgb = mix(col.rgb, backgroundColor, backgroundColorRatio * (1. - mask));

                // channel clamping

                col.rgb = clamp(col.rgb, 0., 1.);

                return col;
            }

            void main () {
                vec2 uv = gl_FragCoord.xy / resolution.xy;
                fragColor = process(uv);
            }
        `, {
            source: 't',
            translationX: 'f',
            translationY: 'f',
            rotation: 'f',
            zoom: 'f',
            multiplier: 'f',
            add: 'f',
            type: 'i',
            brightness: 'f',
            contrast: 'f',
            saturation: 'f',

            iridescenceAmount: 'f',
            iridescencePower: 'f',
            iridescenceScale: 'f',
            iridescencePower2: 'f',
            lumaFactor1: 'f',
            lumaFactor2: 'f',

            hueShift: 'f',
            tintAmount: 'f',
            tintColor: '3f',
            hueChangeOnBackground: 'f',

            backgroundRegenerate: 'b',
            backgroundColor: '3f',
            backgroundColorRatio: 'f',
        });
    }

    return matcapProgram;
}

/**
 *
 * @param context
 * @returns {WorkingWebGLProgram}
 */
function getAngularBlurProgram (context) {
    if (angularBlurProgram === null) {
        angularBlurProgram = context.createProgram(`#version 300 es
            precision highp float;
            precision highp int;
            precision highp sampler2D;

            layout(location = 0) out vec4 fragColor;

            uniform vec2 resolution;

            uniform float angle;
            uniform float parabolaFactor;
            uniform float distanceFactor;
            uniform float distancePower;

            uniform sampler2D source;
            uniform bool sourceSet;
            uniform vec2 sourceSize;

            const vec2 center = vec2(0.5, 0.5);

            float hemisphere(in vec2 cuv) {
                return min(1.0, sqrt(max(0., 1.0 - cuv.x * cuv.x - cuv.y * cuv.y)));
            }
            
            float getAngleMultiplier (vec2 uv) {
                return (1.0 - distanceFactor) + distanceFactor * pow(1. - hemisphere(uv), distancePower);
            }

            vec4 process (in vec2 uv) {
                vec2 icenter = vec2(center.x, center.y);
                
                uv = uv - icenter;
                float a = atan(uv.y, uv.x);
                float l = length(uv);
                vec3 base = vec3(0.);
                float sumWeights = 0.;
                float iterations = clamp(100., 1., 180.);

                float angleMultiplier = getAngleMultiplier(uv * 2.) * 6.283185307179586 * angle / iterations / 2.;

                for (float i = -iterations; i <= iterations; i++) {
                    float k = (i + iterations) / (iterations * 2. + 0.00001);
                    float w = pow(4.0 * k * (1. - k), parabolaFactor);
                    float an = a + i * angleMultiplier;
                    uv.x = cos(an) * l + icenter.x;
                    uv.y = sin(an) * l + icenter.y;
                    
                    base += texture(source, clamp(uv, 0.0, 1.0)).rgb * w;
                    sumWeights+=w;
                }
                
                base = clamp(base / sumWeights, 0., 1.);
                
                return vec4(base, 1.);
            }

            void main () {
                vec2 uv = gl_FragCoord.xy / resolution.xy;
                fragColor = process(uv);
            }
        `, {
            source: 't',
            angle: 'f',
            parabolaFactor: 'f',
            distancePower: 'f',
            distanceFactor: 'f'
        });
    }

    return angularBlurProgram;
}

/**
 * 
 * @param context
 * @param {WorkingTexture} context 
 */
function getWorkingTexture (context) {
    if (workingTexture === null) {
        workingTexture = context.createTexture(512, 512, false);
    }

    return workingTexture;
}

function matcapProcess (context, inputs, outputs, parameters) {
    const intermediateTexture = getWorkingTexture(context);
  
    getMatcapProgram(context).execute({
        source: inputs.input,
        translationX: parameters.translationX,
        translationY: parameters.translationY,
        rotation: parameters.rotation,
        rotation: parameters.rotation,
        zoom: parameters.zoom,
        multiplier: parameters.multiplier,
        add: parameters.add,
        type: parameters.type,
        brightness: parameters.brightness,
        contrast: parameters.contrast,
        saturation: parameters.saturation,

        iridescenceAmount: parameters.iridescenceAmount,
        iridescencePower: parameters.iridescencePower,
        iridescenceScale: parameters.iridescenceScale,
        iridescencePower2: parameters.iridescencePower2,
        lumaFactor1: parameters.lumaFactor1,
        lumaFactor2: parameters.lumaFactor2,

        hueShift: parameters.hueShift,
        tintAmount: parameters.tintAmount,
        tintColor: parameters.tintColor.map(v => v / 255),
        hueChangeOnBackground: parameters.hueChangeOnBackground,

        backgroundRegenerate: parameters.backgroundRegenerate,
        backgroundColor: parameters.backgroundColor.map(v => v / 255),
        backgroundColorRatio: parameters.backgroundColorRatio,
    }, intermediateTexture);

    getAngularBlurProgram(context).execute({
        source: intermediateTexture,
        angle: parameters.angle,
        parabolaFactor: parameters.parabolaFactor,
        distanceFactor: parameters.distanceFactor,
        distancePower: parameters.distancePower
    }, outputs.output);
}

module.exports = matcapProcess;