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

WorkingTexture.prototype.floatArray = null;
WorkingTexture.prototype.floatArrayReady = null;
WorkingTexture.prototype.imageData = null;
WorkingTexture.prototype.imageDataReady = null;
WorkingTexture.prototype.webglFrameBuffer = null;
WorkingTexture.prototype.webglTexture = null;

/**
 * Initialize the internal state of the texture to opaque black.
 *
 * @protected
 */
WorkingTexture.prototype.initialize = function () {
  var gl = this.context.working.gl;

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

  this.imageData = null;
  this.imageDataReady = false;
  this.floatArray = null;
  this.floatArrayReady = false;
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
 * Retrieve the texture as a Float32Array.
 *
 * @returns {Float32Array}
 * @public
 */
WorkingTexture.prototype.getFloatArray = function () {
  // create the Float32Array if it doesn't already exist
  if (this.floatArray === null) {
    this.floatArray = new Float32Array(4 * this.width * this.height);
  }

  // if not floatArrayReady, read pixels from texture
  if (!this.floatArrayReady) {
    var gl = this.context.working.gl;

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.webglFrameBuffer);
    gl.readPixels(0, 0, this.width, this.height, gl.RGBA, gl.FLOAT, this.floatArray, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    this.floatArrayReady = true;
  }

  return this.floatArray;
};

/**
 * Retrieve the texture as an instance of ImageData.
 *
 * @returns {ImageData}
 * @public
 */
WorkingTexture.prototype.getImageData = function () {
  // create the ImageData if it doesn't already exist
  if (this.imageData === null) {
    this.imageData = new ImageData(this.width, this.height);
  }

  // if not imageDataReady, getFloatArray and populate imageData
  if (!this.imageDataReady) {
    var floatArray = this.getFloatArray();

    for(var i = 0; i < floatArray.length / 4; i++) {
      var x = i % this.width;
      var y = this.height - (i / this.width | 0) - 1;
      var idx = (y * this.width + x) * 4;

      this.imageData.data[idx] = Math.round(floatArray[i * 4] * 255);
      this.imageData.data[idx + 1] = Math.round(floatArray[i * 4 + 1] * 255);
      this.imageData.data[idx + 2] = Math.round(floatArray[i * 4 + 2] * 255);
      this.imageData.data[idx + 3] = Math.round(floatArray[i * 4 + 3] * 255);
    }

    this.imageDataReady = true;
  }

  return this.imageData;
};

/**
 * Update the texture based on its internal webgl state.
 *
 * @public
 */
WorkingTexture.prototype.updateFromInternalTexture = function () {
  this.floatArrayReady = false;
  this.imageDataReady = false;
};

/**
 * Update the texture based on a given image element.
 *
 * @param HTMLImageElement img
 *
 * @public
 */
WorkingTexture.prototype.updateFromImageElement = function (img) {
  var gl = this.context.working.gl;

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
 * Update the texture based on its internal Float32Array.
 *
 * @public
 */
WorkingTexture.prototype.updateFromInternalFloatArray = function () {
  var gl = this.context.working.gl;

  gl.bindTexture(gl.TEXTURE_2D, this.webglTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, this.width, this.height, 0, gl.RGBA, gl.FLOAT, this.floatArray);

  if (this.mipmap) {
    gl.generateMipmap(gl.TEXTURE_2D);
  }

  gl.bindTexture(gl.TEXTURE_2D, null);

  this.imageDataReady = false;
  this.floatArrayReady = true;
};

/**
 * Update the texture based on a Float32Array.
 *
 * @param {Float32Array} floatArray
 * @public
 */
WorkingTexture.prototype.updateFromFloatArray = function (floatArray) {
  // create the Float32Array if it doesn't already exist
  if (this.floatArray === null) {
    this.floatArray = new Float32Array(4 * this.width * this.height);
  }

  this.floatArray.set(floatArray, 0);

  this.updateFromInternalFloatArray();
};

/**
 * Update the texture based on an instance of ImageData.
 *
 * @param {ImageData} imageData
 * @public
 */
WorkingTexture.prototype.updateFromImageData = function (imageData) {
  // create the ImageData if it doesn't already exist
  if (this.imageData === null) {
    this.imageData = new ImageData(this.width, this.height);
  }

  // create the Float32Array if it doesn't already exist
  if (this.floatArray === null) {
    this.floatArray = new Float32Array(4 * this.width * this.height);
  }

  this.imageData.data.set(imageData.data, 0);

  for (var i = 0; i < imageData.data.length / 4; i++) {
    var x = i % this.width;
    var y = this.height - (i / this.width | 0) - 1;
    var idx = (y * this.width + x) * 4;

    this.floatArray[i * 4] = imageData.data[idx] / 255;
    this.floatArray[i * 4 + 1] = imageData.data[idx + 1] / 255;
    this.floatArray[i * 4 + 2] = imageData.data[idx + 2] / 255;
    this.floatArray[i * 4 + 3] = imageData.data[idx + 3] / 255;
  }

  this.updateFromInternalFloatArray();

  this.imageDataReady = true;
};

/**
 * Free the resources used for the texture.
 *
 * @public
 */
WorkingTexture.prototype.dispose = function () {
  var gl = this.context.working.gl;

  gl.deleteFramebuffer(this.webglFrameBuffer);
  gl.deleteTexture(this.webglTexture);

  this.webglFrameBuffer = null;
  this.webglTexture = null;
  this.imageData = null;
  this.floatArray = null;
};

/**
 * Create a WorkingTexture from an image file.
 *
 * @param context
 * @param file
 * @param callback
 *
 * @static
 * @public
 */
WorkingTexture.fromImageFile = function (context, file, callback) {
  var fr = new FileReader();
  var img = new Image();

  fr.addEventListener('load', function () {
    img.src = fr.result;
  });

  img.addEventListener('load', function () {
    var texture = new WorkingTexture(context, img.naturalWidth, img.naturalHeight, false, false, false);
    texture.updateFromImageElement(img);

    callback(texture);
  });

  fr.readAsDataURL(file);
};

module.exports = WorkingTexture;