export const escape2RawWindowKeys = [
  'getComputedStyle',
  'visualViewport',
  'matchMedia',
  // 'DOMParser',
  'ResizeObserver',
  'IntersectionObserver',
  // 'dispatchEvent',
]

export const escape2RawWindowRegExpKeys = [
  /animationFrame$/i,
  /mutationObserver$/i,
  /height$|width$/i,
  /offset$/i,
  // /event$/i,
  /selection$/i,
  /^range/i,
  /^screen/i,
  /^scroll/i,
  /X$|Y$/,
  /frameElement$/,
]

export const uniqueDocumentElement = [
  'body',
  'head',
  'html',
  'title',
]

export const hijackMicroLocationKeys = [
  'host',
  'hostname',
  'port',
  'protocol',
  'origin',
]

// 有shadowRoot则代理到shadowRoot否则代理到原生document上 (属性)
export const proxy2RawDocOrShadowKeys = [
  'childElementCount',
  'children',
  'firstElementChild',
  'firstChild',
  'lastElementChild',
  'activeElement', // Element not has, document or shadowRoot has
  'fullscreenElement', // Element not has, document or shadowRoot has
  'pictureInPictureElement', // Element not has, document or shadowRoot has
  'pointerLockElement', // Element not has, document or shadowRoot has
  'styleSheets', // Element not has, document or shadowRoot has
]

// 有shadowRoot则代理到shadowRoot否则代理到原生document上 (方法)
export const proxy2RawDocOrShadowMethods = [
  'append',
  'contains',
  'replaceChildren',
  'createRange', // Element not has, document or shadowRoot has
  'getSelection', // Element not has, document or shadowRoot has
  'elementFromPoint', // Element not has, document or shadowRoot has
  'elementsFromPoint', // Element not has, document or shadowRoot has
  'getAnimations', // Element not has, document or shadowRoot has
]

// 直接代理到原生document上 (属性)
export const proxy2RawDocumentKeys = [
  'characterSet',
  'compatMode',
  'contentType',
  'designMode',
  'dir',
  'doctype',
  'embeds',
  'fullscreenEnabled',
  'hidden',
  'implementation',
  'lastModified',
  'pictureInPictureEnabled',
  'plugins',
  'readyState',
  'referrer',
  'visibilityState',
  'fonts',
]

// 直接代理到原生document上 (方法)
export const proxy2RawDocumentMethods = [
  'execCommand',
  'createRange',
  'exitFullscreen',
  'exitPictureInPicture',
  'getElementsByTagNameNS',
  'hasFocus',
  'prepend',
  // 'dispatchEvent',
]
