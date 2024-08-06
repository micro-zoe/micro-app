export const escape2RawWindowKeys = [
  'getComputedStyle',
  // FIX ISSUE: https://github.com/micro-zoe/micro-app/issues/1292
  'DOMParser',
  'visualViewport',
  'matchMedia',
  'ResizeObserver',
  'IntersectionObserver',
]

export const escape2RawWindowRegExpKeys = [
  /animationFrame$/i,
  /mutationObserver$/i,
  /height$|width$/i,
  /offset$/i,
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

// hijack InstanceOf of iframe class
export const hijackInstanceOfWindowRegExpKeys = [
  /^((HTML|SVG)\w*|MathML)?Element$/,
  /^(Node|Text|Attr|Comment|EventTarget|CharacterData|NamedNodeMap|ShadowRoot)$/,
  /^Document(Type|Fragment)?$/,
  /^(?!PopState).*Event$/,
  /^DataTransfer/
]

// proxy to shadowRoot or rawDocument (property)
export const proxy2RawDocOrShadowKeys = [
  'childElementCount',
  'children',
  'firstElementChild',
  'firstChild',
  'lastElementChild',
  'activeElement', // not for Element, just for document/shadowRoot
  'fullscreenElement', // not for Element, just for document/shadowRoot
  'pictureInPictureElement', // not for Element, just for document/shadowRoot
  'pointerLockElement', // not for Element, just for document/shadowRoot
  'styleSheets', // not for Element, just for document/shadowRoot
]

// proxy to shadowRoot or rawDocument (method)
export const proxy2RawDocOrShadowMethods = [
  'append',
  'contains',
  'replaceChildren',
  'createRange', // not for Element, just for document/shadowRoot
  'getSelection', // not for Element, just for document/shadowRoot
  'elementFromPoint', // not for Element, just for document/shadowRoot
  'elementsFromPoint', // not for Element, just for document/shadowRoot
  'getAnimations', // not for Element, just for document/shadowRoot
]

// proxy to rawDocument (property)
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

// proxy to rawDocument (method)
export const proxy2RawDocumentMethods = [
  'execCommand',
  'createRange',
  'exitFullscreen',
  'exitPictureInPicture',
  'getElementsByTagNameNS',
  'hasFocus',
  'prepend',
]
