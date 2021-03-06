"use strict";

/**
 * Create a shader.
 *
 * @param {WebGLRenderingContext} context
 * @param {int} type FRAGMENT_SHADER or VERTEX_SHADER
 * @param {string} src Source of the shader
 * @returns {WebGLShader}
 */
function createShader(context, type, src) {
  const shader = context.createShader(type);
  context.shaderSource( shader, src );
  context.compileShader( shader );

  if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
    throw new Error('Error creating shader : ' + context.getShaderInfoLog(shader) + '\n' + src);
  }

  return shader;
};

const vertexShader = `#version 300 es
  precision highp float;
  precision highp int;

  in vec2 vertexPosition;

  void main() {
    gl_Position = vec4(vertexPosition, 0.0, 1.0);
  }
`;

const types = {
  'b': {
    method: 'uniform1f',
    defaultValue: 0
  },
  '1i': {
    method: 'uniform1i',
    defaultValue: 0
  },
  '1f': {
    method: 'uniform1f',
    defaultValue: 0
  },
  '2f': {
    method: 'uniform2f',
    defaultValue: [0, 0]
  },
  '3f': {
    method: 'uniform3f',
    defaultValue: [0, 0, 0]
  },
  '4f': {
    method: 'uniform4f',
    defaultValue: [0, 0, 0, 0]
  }
};

types.f = types['1f'];
types.i = types['1i'];

function WorkingWebGLProgram (context, fragmentShader, uniforms) {
  this.context = context;

  // store the inputs
  // the actual initialization of the shaders is deferred until the first use of the program

  this.inputs = {
    fragmentShader: fragmentShader,
    uniforms: JSON.parse(JSON.stringify(uniforms)) // deep clone for security
  };
}

/**
 * Initialize the shaders and program based on the stored inputs.
 *
 * @protected
 */
WorkingWebGLProgram.prototype.initialize = function () {
  const gl = this.context.working.gl;
  const fragmentShader = this.inputs.fragmentShader;
  const uniforms = this.inputs.uniforms;

  this.program = gl.createProgram();
  const vertexShaderInstance = createShader(gl, gl.VERTEX_SHADER, vertexShader);
  const fragmentShaderInstance = createShader(gl, gl.FRAGMENT_SHADER, fragmentShader);

  gl.attachShader(this.program, vertexShaderInstance);
  gl.attachShader(this.program, fragmentShaderInstance);

  gl.linkProgram(this.program);
  gl.validateProgram(this.program);

  if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
    throw new Error('Could not initialise shaders: ' + gl.getProgramInfoLog(this.program));
  }

  gl.deleteShader(vertexShaderInstance);
  gl.deleteShader(fragmentShaderInstance);

  uniforms.resolution = '2f';
  uniforms.seed = '1f';

  const uniformsKeys = Object.keys(uniforms);
  this.uniformsInfo = [];
  this.texturesInfo = [];

  let textureNumber = 0;
  for (let i = 0; i < uniformsKeys.length; i++) {
    const uniform = uniformsKeys[i];
    const type = uniforms[uniform];

    if (type === 't') {
      this.texturesInfo.push({
        id: uniform,
        textureNumber: textureNumber,
        textureUnit: gl['TEXTURE' + textureNumber],
        location: gl.getUniformLocation(this.program, uniform),
        setLocation: gl.getUniformLocation(this.program, uniform + 'Set'),
        sizeLocation: gl.getUniformLocation(this.program, uniform + 'Size')
      });

      textureNumber++;
    } else {
      this.uniformsInfo.push({
        id: uniform,
        method: types[type].method,
        defaultValue: types[type].defaultValue,
        location: gl.getUniformLocation(this.program, uniform)
      });
    }
  }

  this.vertexPositionAttribute = gl.getAttribLocation(this.program, 'vertexPosition');
  gl.enableVertexAttribArray(this.vertexPositionAttribute);
};

/**
 * Retrieve the WebGLProgram.
 *
 * @returns {WebGLProgram}
 * @protected
 */
WorkingWebGLProgram.prototype.getProgram = function () {
  if (!this.program) {
    this.initialize();
  }

  return this.program;
};

/**
 * Execute the program.
 *
 * @param uniforms
 * @param {WorkingTexture|object} workingTexture
 * @public
 */
WorkingWebGLProgram.prototype.execute = function (uniforms, workingTexture) {
  uniforms = uniforms || {};
  uniforms.resolution = [ workingTexture.width, workingTexture.height ];

  if (!uniforms.hasOwnProperty('seed')) {
    uniforms.seed = 0.;
  }

  const context = this.context;
  const program = this.getProgram();
  const isActualWorkingTexture = workingTexture.constructor.name === 'WorkingTexture';
  const frameBuffer = isActualWorkingTexture ? workingTexture.getFrameBuffer() : null;

  context.working.resize(workingTexture.width, workingTexture.height);

  context.working.gl.useProgram(program);

  for (let i = 0; i < this.uniformsInfo.length; i++) {
    const uniform = this.uniformsInfo[i];
    let value = uniform.defaultValue;
    const typeOfValue = typeof uniforms[uniform.id];

    if (typeOfValue === 'boolean') {
      value = uniforms[uniform.id] ? 1 : 0;
    } else if (typeOfValue !== 'undefined') {
      value = uniforms[uniform.id];
    }

    context.working.gl[uniform.method].apply(context.working.gl, [uniform.location].concat(value));
  }

  for (let i = 0; i < this.texturesInfo.length; i++) {
    const texture = this.texturesInfo[i];
    const value = uniforms[texture.id];

    context.working.gl.activeTexture(texture.textureUnit);
    context.working.gl.bindTexture(context.working.gl.TEXTURE_2D, value && typeof value.getTexture === 'function' ? value.getTexture() : context.working.defaultTexture);
    context.working.gl.uniform1i(texture.location, texture.textureNumber);
    context.working.gl.uniform1f(texture.setLocation, value ? 1. : 0.);
    context.working.gl.uniform2f(texture.sizeLocation, value ? value.width : 0,  value ? value.height : 0);
  }

  //context.working.gl.bindBuffer(context.working.gl.ARRAY_BUFFER, context.working.triangleBuffer);
  context.working.gl.vertexAttribPointer(this.vertexPositionAttribute, context.working.triangleBufferItemSize, context.working.gl.FLOAT, false, 0, 0);

  context.working.gl.bindFramebuffer(context.working.gl.FRAMEBUFFER, frameBuffer);
  context.working.gl.drawArrays(context.working.gl.TRIANGLES, 0, context.working.triangleBufferNumItems);

  // clean the webgl context

  for (let i = 0; i < this.texturesInfo.length; i++) {
    const texture = this.texturesInfo[i];

    context.working.gl.activeTexture(texture.textureUnit);
    context.working.gl.bindTexture(context.working.gl.TEXTURE_2D, null);
  }

  context.working.gl.useProgram(null);
  context.working.gl.bindFramebuffer(context.working.gl.FRAMEBUFFER, null);
};

/**
 * Free the resources used for the program.
 *
 * @public
 */
WorkingWebGLProgram.prototype.dispose = function () {
  if (this.program) {
    const gl = this.context.working.gl;

    gl.deleteProgram(this.program);

    this.program = null;
  }
};

module.exports = WorkingWebGLProgram;