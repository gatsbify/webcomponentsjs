/**
 * @license
 * Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

(function() {
  'use strict';

  var polyfillsLoaded = false;
  var whenLoadedFns = [];
  var allowUpgrades = false;
  var flushFn;

  function fireEvent() {
    window.WebComponents.ready = true;
    document.dispatchEvent(new CustomEvent('WebComponentsReady', { bubbles: true }));
  }

  function batchCustomElements() {
    if (window.customElements && customElements.polyfillWrapFlushCallback) {
      customElements.polyfillWrapFlushCallback(function (flushCallback) {
        flushFn = flushCallback;
        if (allowUpgrades) {
          flushFn();
        }
      });
    }
  }

  function asyncReady() {
    batchCustomElements();
    ready();
  }

  function ready() {
    // bootstrap <template> elements before custom elements
    if (window.HTMLTemplateElement && HTMLTemplateElement.bootstrap) {
      HTMLTemplateElement.bootstrap(window.document);
    }
    polyfillsLoaded = true;
    runWhenLoadedFns().then(fireEvent);
  }

  function runWhenLoadedFns() {
    allowUpgrades = false;
    var done = function() {
      allowUpgrades = true;
      whenLoadedFns.length = 0;
      flushFn && flushFn();
    };
    return Promise.all(whenLoadedFns.map(function(fn) {
      return fn instanceof Function ? fn() : fn;
    })).then(done, function(err) {
      console.error(err);
    });
  }

  window.WebComponents = window.WebComponents || {
    ready: false,
    _batchCustomElements: batchCustomElements,
    waitFor: function(waitFn) {
      if (!waitFn) {
        return;
      }
      whenLoadedFns.push(waitFn);
      if (polyfillsLoaded) {
        runWhenLoadedFns();
      }
    }
  };

  var name = 'webcomponents-loader.js';
  // Feature detect which polyfill needs to be imported.
  var polyfills = [];
  if (!('attachShadow' in Element.prototype && 'getRootNode' in Element.prototype) ||
    (window.ShadyDOM && window.ShadyDOM.force)) {
    polyfills.push('sd');
  }
  if (!window.customElements || window.customElements.forcePolyfill) {
    polyfills.push('ce');
  }
  // NOTE: any browser that does not have template or ES6 features
  // must load the full suite of polyfills.
  if (!('content' in document.createElement('template')) || !window.Promise || !Array.from ||
    // Edge has broken fragment cloning which means you cannot clone template.content
    !(document.createDocumentFragment().cloneNode() instanceof DocumentFragment)) {
    polyfills = ['sd-ce-pf'];
  }

  if (polyfills.length) {
    var script = document.querySelector('script[src*="' + name +'"]');
    var newScript = document.createElement('script');
    // Load it from the right place.
    var replacement = 'bundles/webcomponents-' + polyfills.join('-') + '.js';
    var url = script.src.replace(name, replacement);
    newScript.src = url;
    // if readyState is 'loading', this script is synchronous
    if (document.readyState === 'loading') {
      // make sure custom elements are batched whenever parser gets to the injected script
      newScript.setAttribute('onload', 'window.WebComponents._batchCustomElements()');
      document.write(newScript.outerHTML);
      document.addEventListener('DOMContentLoaded', ready);
    } else {
      newScript.addEventListener('load', function () {
        asyncReady();
      });
      newScript.addEventListener('error', function () {
        throw new Error('Could not load polyfill bundle' + url);
      });
      document.head.appendChild(newScript);
    }
  } else {
    polyfillsLoaded = true;
    if (document.readyState === 'complete') {
      ready()
    } else {
      window.addEventListener('DOMContentLoaded', ready)
    }
  }
})();
