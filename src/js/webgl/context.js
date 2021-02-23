"use strict";

const WorkingContext = require('./working-context');
const WorkingProgram = require('./working-program');
const WorkingTexture = require('./working-texture');

function Context (width, height) {
  this.working = new WorkingContext(width, height);
}

/**
 *
 * @param {string} fragmentShader
 * @param {object} uniforms
 * @returns {WorkingWebGLProgram}
 */
Context.prototype.createProgram = function (fragmentShader, uniforms) {
  return new WorkingProgram(this, fragmentShader, uniforms);
};

/**
 *
 * @param {int} width
 * @param {int} height
 * @param {bool} repeat
 * @returns {WorkingTexture}
 */
Context.prototype.createTexture = function (width, height, repeat) {
  return new WorkingTexture(this, width, height, repeat, false, false);
};

module.exports = Context;