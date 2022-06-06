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

            const int COLORS_MODEL_SMOOTH = 1;
            const int COLORS_MODEL_STANDARD = 0;

            const int IRIDESCENCE_MODEL_FRESNEL = 0;
            const int IRIDESCENCE_MODEL_CHROMATIC_ABHERRATION = 1;

            const float PI = 3.141592653;
            const float PI2 = 6.283185307;

            uniform vec2 resolution;

            uniform float translationX;
            uniform float translationY;
            uniform float zoom;

            uniform float rotation;
            uniform float curveMultiplier;
            uniform float curveAdd;

            uniform int type;
            uniform float hueShift;
            uniform float brightness;
            uniform float contrast;
            uniform float pivot;
            uniform float saturation;
            uniform float tintAmount;
            uniform vec3 tintColor;

            uniform bool backgroundRegenerate;
            uniform float hueChangeOnBackground;

            uniform int iridescenceType;
            uniform float iridescenceAmount;
            uniform float iridescenceScale;
            uniform float iridescencePower1;
            uniform float iridescencePower2;
            uniform float iridescenceLumaFactor1;
            uniform float iridescenceLumaFactor2;

            uniform float iridescenceReductionByLuma;
            uniform float iridescenceGreenOffset;
            uniform float iridescenceBlueOffset;
            
            uniform vec3 shadowingPosition;
            uniform vec3 shadowingColor;
            uniform float shadowingAmount;
            uniform float shadowingPower;
            uniform float shadowingHalfLambertian;
            uniform float shadowingReductionByLuma;
            
            uniform float rimWidth;
            uniform float rimBlending;
            uniform float rimPower;
            uniform float rimAmount;
            uniform vec3 rimColor;
            uniform float rimPositionX;
            uniform float rimPositionY;

            uniform sampler2D source;
            uniform bool sourceSet;
            uniform vec2 sourceSize;

            // https://gist.github.com/yiwenl/745bfea7f04c456e0101 (much better than previous implementation)
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

            vec3 hsl2rgb (in vec3 c) {
              vec3 rgb = clamp( abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0, 1.0 );
              return c.z + c.y * (rgb-0.5)*(1.0-abs(2.0*c.z-1.0));
            }

            vec3 hslShift(vec3 color) {
                color = rgb2hsl(color);
                color.r = color.r + hueShift + 1.;
                return hsl2rgb(color);
            }

            vec2 rotate(in vec2 v, in float a) {
                float s = sin(a);
                float c = cos(a);
                mat2 m = mat2(c, -s, s, c);
                return m * v;
            }

            float hemisphere(in vec2 cuv) {
                return min(1.0, sqrt(max(0., 1.0 - cuv.x * cuv.x - cuv.y * cuv.y)));
            }

            float luma(in vec3 col) {
                return clamp(dot(col.rgb, vec3(0.299, 0.587, 0.114)), 0., 1.);
            }

            vec4 sampleSource(in vec2 uv) {
                vec2 scaleSource = sourceSize / min(sourceSize.x, sourceSize.y);
                vec2 nuv = rotate(uv - 0.5, rotation * PI2) / zoom / scaleSource + 0.5 - vec2(translationX, translationY) * 0.5;
                return texture(source, nuv);
            }

            vec3 applyCurveTransformation (vec3 cuv3, in float multiplier, in float add) {
                cuv3.z = cuv3.z * multiplier + add;
                return normalize(cuv3);
            }

            vec4 applyColorTransformations (vec4 col, float colLuma, float mask) {
                // hue shift

                col.rgb = mix(
                    col.rgb,
                    mix(hslShift(col.rgb), col.rgb, step(fract(hueShift), 0.)),
                    mix(mask, 1., hueChangeOnBackground)
                );

                // brightness and contrast

                if (type == COLORS_MODEL_SMOOTH) {
                    // apply contrast
                    // very arbitrary mapping from [-1,1] to [0. (0**(1+0)), 3. (2**(1+0.5849625007))]
                    float icontrast = pow(contrast + 1., 1.0 + 0.5849625007 * pow((contrast + 1.) / 2., 4.));
                    col.rgb = (col.rgb - pivot) * icontrast + pivot;
                    //apply brightness
                    float midPoint = 0.5 + brightness / 4.0;
                    float range = min(abs(midPoint), abs(1. - midPoint));
                    col.rgb = mix(vec3(midPoint - range), vec3(midPoint + range), col.rgb);
                } else {
                    col.rgb = (col.rgb - pivot) * (contrast + 1.) + brightness + pivot;
                }

                // desaturation and tinting
                
                float updatedColLuma = luma(col.rgb);

                col.rgb = mix(
                    vec3(updatedColLuma),
                    col.rgb,
                    saturation
                );

                col.rgb = mix(
                    col.rgb,
                    vec3(updatedColLuma) * tintColor,
                    tintAmount * mix(mask, 1., hueChangeOnBackground)
                );

                return col;
            }
            
            float sampleFresnel(vec3 normal) {
                vec3 viewDirectionW = normalize(normal);
                vec3 eye = normalize(vec3(-rimPositionX, -rimPositionY, 1.0));
                return rimWidth * clamp(1.0 - dot(eye, normal), 0.0, 1.0);
            }

            vec4 process (in vec2 uv) {
                vec2 cuv = (uv - 0.5) * 2.0;

                // used to limit some effects (iridescence and hue shift) to the inner part of the matcap
                float mask = clamp((100. - length(cuv*0.999) * 99.), 0., 1.);

                float z = hemisphere(cuv);
                vec3 cuv3 = vec3(cuv, z);
                vec3 originalCuv3 = cuv3;
                
                float h = length(cuv3.xy);
                cuv3 = applyCurveTransformation(cuv3, curveMultiplier, curveAdd);

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

                float colLuma = luma(col.rgb);
                col = applyColorTransformations(col, colLuma, mask);

                // iridescence

                if (iridescenceType == IRIDESCENCE_MODEL_CHROMATIC_ABHERRATION) {
                    // modify each cuv curve with multiplier to offset them
                    float cuv3gMultiplier = iridescenceGreenOffset * mix(0.8, 0.6, (1. + sign(iridescenceGreenOffset)) * 0.5);
                    float cuv3bMultiplier = iridescenceBlueOffset * mix(0.8, 0.6, (1. + sign(iridescenceBlueOffset)) * 0.5);
                    vec3 cuv3g = applyCurveTransformation(cuv3, 1.0 + sign(iridescenceGreenOffset) * pow(abs(cuv3gMultiplier), 1.5) * (1. - pow(z, 1.3) * 0.5), 0.);
                    vec3 cuv3b = applyCurveTransformation(cuv3, 1.0 + sign(iridescenceBlueOffset) * pow(abs(cuv3bMultiplier), 1.5) * (1. - pow(z, 1.3) * 0.5), 0.);

                    // sample each offsetted channel and apply color transformations to them
                    vec4 colg = sampleSource(cuv3g.xy * 0.5 + 0.5);
                    colg = applyColorTransformations(colg, luma(colg.rgb), mask);
                    vec4 colb = sampleSource(cuv3b.xy * 0.5 + 0.5);
                    colb = applyColorTransformations(colb, luma(colb.rgb), mask);

                    // get luma factor
                    float colLumaFactor = mix(0., 1. - colLuma, iridescenceReductionByLuma);

                    // merge the iridescence channel using luma factor
                    vec3 iricol = col.rgb * vec3(1., colLumaFactor, colLumaFactor);
                    iricol += colg.rgb * vec3(0., 1. - colLumaFactor, 0.);
                    iricol += colb.rgb * vec3(0., 0., 1. - colLumaFactor);

                    // apply the iridescence
                    col.rgb = mix(col.rgb, clamp(iricol, 0., 1.), mask * iridescenceAmount);
                } else {
                    // arbitrarily compute the iridescence based on the fresnel / hemisphere height
                    float lz = z * mix(1., 0.2 + 0.8 * z, clamp(colLuma * iridescenceLumaFactor1, 0., 1.));
                    float iridescencePower2m = 0.01 + 0.99 * iridescencePower2;
                    float nz = pow(pow(lz, 1. / iridescencePower2m), iridescencePower1) * iridescenceScale;
                    vec3 iridescence = mix(vec3(1.5,1., 0.1), vec3(0.1, 0.0, 1.5), clamp(nz, 0., 1.));

                    // apply the iridescence
                    float ratio = pow(clamp(1. - colLuma, 0., 1.), iridescenceLumaFactor2) * (1. - pow(clamp(z, 0., 1.), iridescencePower2m)) * mask;
                    col.rgb = mix(col.rgb, iridescence, ratio * iridescenceAmount);
                }
                
                // shadowing
                
                col.rgb = clamp(col.rgb, 0., 1.);
                
                // generalized Lambertian / Half Lambertian
                float NdotL = dot(normalize(shadowingPosition - originalCuv3), normalize(originalCuv3));
                NdotL = NdotL * (1. - 0.5 * shadowingHalfLambertian) + 0.5 * shadowingHalfLambertian;
                NdotL = sign(NdotL) * pow(abs(NdotL), 1. + shadowingHalfLambertian);
                
                // updated luma accounting for the iridescence
                colLuma = luma(col.rgb);
                
                float shadowingLumaFactor = mix(0., colLuma, shadowingReductionByLuma);
                float shadowingFactor = shadowingAmount * (1. - clamp(NdotL * (1. + pow(shadowingLumaFactor, 2.2)), 0., 1.));
                col.rgb = mix(col.rgb, shadowingColor * 0.25, pow(shadowingFactor, shadowingPower));
                
                // fresnel rim
                
                float fresnelRim = sampleFresnel(normalize(originalCuv3));
                fresnelRim = clamp(pow(fresnelRim, rimPower), 0., 1.) * rimAmount * mask;
                
                fresnelRim = fresnelRim * mix(1., clamp(1. - distance(rimColor, col.rgb) / 1.6, 0., 1.), rimBlending);
                
                col.rgb = col.rgb + rimColor * fresnelRim;
                
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
            zoom: 'f',

            rotation: 'f',
            curveMultiplier: 'f',
            curveAdd: 'f',

            type: 'i',
            hueShift: 'f',
            brightness: 'f',
            contrast: 'f',
            pivot: 'f',
            saturation: 'f',
            tintAmount: 'f',
            tintColor: '3f',

            iridescenceType: 'i',
            iridescenceAmount: 'f',
            iridescenceScale: 'f',
            iridescencePower1: 'f',
            iridescencePower2: 'f',
            iridescenceLumaFactor1: 'f',
            iridescenceLumaFactor2: 'f',

            iridescenceReductionByLuma: 'f',
            iridescenceGreenOffset: 'f',
            iridescenceBlueOffset: 'f',

            shadowingPosition: '3f',
            shadowingColor: '3f',
            shadowingAmount: 'f',
            shadowingPower: 'f',
            shadowingHalfLambertian: 'f',
            shadowingReductionByLuma: 'f',

            rimWidth: 'f',
            rimBlending: 'f',
            rimPower: 'f',
            rimAmount: 'f',
            rimColor: '3f',
            rimPositionX: 'f',
            rimPositionY: 'f',

            hueChangeOnBackground: 'f',
            backgroundRegenerate: 'b'
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

            uniform float circularBlurAngle;
            uniform float circularBlurLumaBias;
            uniform float circularBlurParabolaFactor;
            uniform float circularBlurDistanceFactor;
            uniform float circularBlurDistancePower;

            uniform vec3 backgroundColor;
            uniform float backgroundColorRatio;

            uniform sampler2D source;
            uniform bool sourceSet;
            uniform vec2 sourceSize;

            const vec2 icenter = vec2(0.5, 0.5);

            float hemisphere(in vec2 cuv) {
                return min(1.0, sqrt(max(0., 1.0 - cuv.x * cuv.x - cuv.y * cuv.y)));
            }
            
            float getAngleMultiplier (vec2 uv) {
                return (1.0 - circularBlurDistanceFactor) + circularBlurDistanceFactor * pow(1. - hemisphere(uv), circularBlurDistancePower);
            }

            vec4 process (in vec2 uv) {
                vec2 cuv = (uv - 0.5) * 2.;
                // used to apply opaque background color
                float mask = clamp((70. - length(cuv*0.9925) * 69.), 0., 1.);

                uv = uv - icenter;

                float a = atan(uv.y, uv.x);
                float l = length(uv);
                vec3 base = vec3(0.);
                float sumWeights = 0.;
                float iterations = round(20. + pow(circularBlurAngle, 0.4) * 80.);

                float angleMultiplier = getAngleMultiplier(uv * 2.) * 6.283185307179586 * circularBlurAngle / iterations / 2.;

                for (float i = -iterations; i <= iterations; i++) {
                    float an = a + i * angleMultiplier;
                    uv.x = cos(an) * l + icenter.x;
                    uv.y = sin(an) * l + icenter.y;
                    
                    vec3 col = texture(source, clamp(uv, 0.0, 1.0)).rgb;
                    float luma = clamp(dot(col.rgb, vec3(0.299, 0.587, 0.114)), 0., 1.);

                    float k = (i + iterations) / (iterations * 2. + 0.00001);
                    float w = pow(4.0 * k * (1. - k), circularBlurParabolaFactor);
                    float wbias = abs(pow(circularBlurLumaBias, 2.) * 20.) * pow(4.0 * k * (1. - k), circularBlurParabolaFactor * 2.);
                    w = w + pow(clamp(mix(1. - luma, luma, step(0., circularBlurLumaBias)), 0., 1.), 3.) * wbias;
                    base += col * w;
                    sumWeights+=w;
                }
                
                base = clamp(base / sumWeights, 0., 1.);

                // background opaque color

                base.rgb = mix(base.rgb, backgroundColor, backgroundColorRatio * (1. - mask));
                
                return vec4(base, 1.);
            }

            void main () {
                vec2 uv = gl_FragCoord.xy / resolution.xy;
                fragColor = process(uv);
            }
        `, {
            source: 't',
            circularBlurAngle: 'f',
            circularBlurLumaBias: 'f',
            circularBlurParabolaFactor: 'f',
            circularBlurDistancePower: 'f',
            circularBlurDistanceFactor: 'f',
            backgroundColor: '3f',
            backgroundColorRatio: 'f',
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
        zoom: parameters.zoom,

        rotation: parameters.rotation,
        curveMultiplier: parameters.curveMultiplier,
        curveAdd: parameters.curveAdd,

        type: parameters.type,
        brightness: parameters.brightness,
        contrast: parameters.contrast,
        pivot: parameters.pivot,
        saturation: parameters.saturation,

        iridescenceType: parameters.iridescenceType,
        iridescenceAmount: parameters.iridescenceAmount,
        iridescenceScale: parameters.iridescenceScale,
        iridescencePower1: parameters.iridescencePower1,
        iridescencePower2: parameters.iridescencePower2,
        iridescenceLumaFactor1: parameters.iridescenceLumaFactor1,
        iridescenceLumaFactor2: parameters.iridescenceLumaFactor2,
        iridescenceReductionByLuma: parameters.iridescenceReductionByLuma,
        iridescenceGreenOffset: parameters.iridescenceGreenOffset,
        iridescenceBlueOffset: parameters.iridescenceBlueOffset,

        hueShift: parameters.hueShift,
        tintAmount: parameters.tintAmount,
        tintColor: parameters.tintColor.map(v => v / 255),

        shadowingPosition: [parameters.shadowingPositionX, parameters.shadowingPositionY, parameters.shadowingPositionZ],
        shadowingColor: parameters.shadowingColor.map(v => v / 255),
        shadowingAmount: parameters.shadowingAmount,
        shadowingPower: parameters.shadowingPower,
        shadowingHalfLambertian: parameters.shadowingHalfLambertian,
        shadowingReductionByLuma: parameters.shadowingReductionByLuma,

        rimWidth: parameters.rimWidth,
        rimBlending: parameters.rimBlending,
        rimPower: parameters.rimPower,
        rimAmount: parameters.rimAmount,
        rimColor: parameters.rimColor.map(v => v / 255),
        rimPositionX: parameters.rimPositionX,
        rimPositionY: parameters.rimPositionY,

        hueChangeOnBackground: parameters.hueChangeOnBackground,
        backgroundRegenerate: parameters.backgroundRegenerate
    }, intermediateTexture);

    getAngularBlurProgram(context).execute({
        source: intermediateTexture,
        circularBlurAngle: parameters.circularBlurAngle,
        circularBlurLumaBias: parameters.circularBlurLumaBias,
        circularBlurParabolaFactor: parameters.circularBlurParabolaFactor,
        circularBlurDistanceFactor: parameters.circularBlurDistanceFactor,
        circularBlurDistancePower: parameters.circularBlurDistancePower,
        backgroundColor: parameters.backgroundColor.map(v => v / 255),
        backgroundColorRatio: parameters.backgroundColorRatio,
    }, outputs.output);
}

module.exports = matcapProcess;