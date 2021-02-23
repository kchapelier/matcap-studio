"use strict";

function WorkingContext (width, height) {
  this.canvas = document.createElement('canvas');
  this.canvas.width = this.width = width;
  this.canvas.height = this.height = height;

  this.gl = this.canvas.getContext('webgl2', {
    alpha: false,
    depth: false,
    stencil: false,
    antialias: false,
    preserveDrawingBuffer: true
  });

  this.gl.disable(this.gl.DEPTH_TEST);
  this.gl.disable(this.gl.DITHER);

  this.gl.getExtension('OES_texture_float_linear');
  this.gl.getExtension('EXT_color_buffer_float');

  this.gl.viewport(0, 0, width, height);

  this.triangleBuffer = this.gl.createBuffer();
  this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.triangleBuffer);
  this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 4, 4, -1]), this.gl.STATIC_DRAW);
  this.triangleBufferItemSize = 2;
  this.triangleBufferNumItems = 3;

  // 1x1 opaque black texture
  this.defaultTexture = this.gl.createTexture();
  this.gl.bindTexture(this.gl.TEXTURE_2D, this.defaultTexture);
  this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA32F, 1, 1, 0, this.gl.RGBA, this.gl.FLOAT, new Float32Array([0, 0, 0, 1]));
  this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
  this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
}

WorkingContext.prototype.resize = function (width, height) {
  if (this.width !== width || this.height !== height) {
    this.canvas.width = this.width = width;
    this.canvas.height = this.height = height;
    this.gl.viewport(0, 0, width, height);
  }
};

module.exports = WorkingContext;