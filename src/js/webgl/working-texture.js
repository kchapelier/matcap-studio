"use strict";

function WorkingTexture (context, width, height, repeat, mipmap, nearest) {
  this.context = context;
  this.width = width;
  this.height = height;
  this.repeat = !!repeat;
  this.mipmap = !!mipmap;
  this.nearest = !!nearest;

  this.initialize();
}

WorkingTexture.prototype.context = null;
WorkingTexture.prototype.width = null;
WorkingTexture.prototype.height = null;
WorkingTexture.prototype.repeat = null;
WorkingTexture.prototype.mipmap = null;

WorkingTexture.prototype.webglFrameBuffer = null;
WorkingTexture.prototype.webglTexture = null;

/**
 * Initialize the internal state of the texture to opaque black.
 *
 * @protected
 */
WorkingTexture.prototype.initialize = function () {
  const gl = this.context.working.gl;

  this.webglTexture = gl.createTexture();
  this.webglFrameBuffer = gl.createFramebuffer();

  gl.bindTexture(gl.TEXTURE_2D, this.webglTexture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, this.width, this.height, 0, gl.RGBA, gl.FLOAT, null);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, this.repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, this.repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, this.nearest ? gl.NEAREST : gl.LINEAR);

  if (this.mipmap) {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  } else {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, this.nearest ? gl.NEAREST : gl.LINEAR);
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER, this.webglFrameBuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.webglTexture, 0);

  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
};

/**
 * Retrieve the WebGLFramebuffer.
 *
 * @returns {WebGLFramebuffer}
 * @public
 */
WorkingTexture.prototype.getFrameBuffer = function () {
  // should always be up to date
  return this.webglFrameBuffer;
};

/**
 * Retrieve the WebGLTexture.
 *
 * @returns {WebGLTexture}
 * @public
 */
WorkingTexture.prototype.getTexture = function () {
  // should always be up to date
  return this.webglTexture;
};

/**
 * Update the texture based on a given image element.
 *
 * @param HTMLImageElement img
 *
 * @public
 */
WorkingTexture.prototype.updateFromImageElement = function (img) {
  const gl = this.context.working.gl;

  gl.bindTexture(gl.TEXTURE_2D, this.webglTexture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, this.width, this.height, 0, gl.RGBA, gl.FLOAT, img);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

  if (this.mipmap) {
    gl.generateMipmap(gl.TEXTURE_2D);
  }

  gl.bindTexture(gl.TEXTURE_2D, null);

  this.floatArrayReady = false;
  this.imageDataReady = false;
};

/**
 * Free the resources used for the texture.
 *
 * @public
 */
WorkingTexture.prototype.dispose = function () {
  const gl = this.context.working.gl;

  gl.deleteFramebuffer(this.webglFrameBuffer);
  gl.deleteTexture(this.webglTexture);

  this.webglFrameBuffer = null;
  this.webglTexture = null;
  this.imageData = null;
  this.floatArray = null;
};

module.exports = WorkingTexture;