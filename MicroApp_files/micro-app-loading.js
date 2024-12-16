function getStyle(size = 1) {
  const styleText = `
    .micro-app-logo {
      width: 300px;
      height: 300px;
      transform: scale(${size});
      overflow: hidden;
      animation: logo-spin .8s .8s linear infinite;
    }

    @keyframes logo-spin {
      0% {
        transform: scale(${size}) rotate(0);
      }
      100% {
        transform: scale(${size}) rotate(360deg);
      }
    }

    .logo-container {
      display: flex;
      height: 220px;
      width: 220px;
      position: relative;
      margin: 160px auto 0;
    }

    .logo-common-part-con {
      height: 100px;
      width: 110px;
      flex-shrink: 0;
    }

    .logo-common-part {
      height: 100%;
      width: 100%;
      border-radius: 6px;
      animation: logo-part-scale .8s .7s forwards;
    }

    @keyframes logo-part-scale {
      0% {
        height: 100%;
        width: 100%;
      }
      100% {
        height: 60px;
        width: 60px;
        transform: skew(0);
        border-radius: 50%;
      }
    }

    .logo-common-con-top {
      position: absolute;
      left: 50%;
      margin-left: -55px;
      top: -100px;
      animation: shaking-top .8s ease-in-out;
    }

    .logo-common-con-left {
      animation: shaking-left .8s ease-in-out;
    }

    .logo-common-con-right {
      animation: shaking-right .8s ease-in-out;
    }

    @keyframes shaking-left {
      10%, 90% {
        transform: translate3d(-1px, 0, 0);
      }
      25%, 85% {
        transform: translate3d(-2px, 1px, 0);
      }
      20%, 80% {
        transform: translate3d(3px, 2px, 0);
      }
      25%, 75% {
        transform: translate3d(-1px, -2px, 0);
      }
      30%, 70% {
        transform: translate3d(-4px, -1px, 0);
      }
      35%, 65% {
        transform: translate3d(-2px, 1px, 0);
      }
      40%, 60% {
        transform: translate3d(3px, -2px, 0);
      }
      45%, 55% {
        transform: translate3d(0px, 2px, 0);
      }
      50% {
        transform: translate3d(-4px, 1px, 0);
      }
    }

    @keyframes shaking-right {
      10%, 90% {
        transform: translate3d(1px, 2px, 0);
      }
      20%, 80% {
        transform: translate3d(-4px, -1px, 0);
      }
      25%, 75% {
        transform: translate3d(1px, 3px, 0);
      }
      30%, 70% {
        transform: translate3d(4px, -2px, 0);
      }
      35%, 65% {
        transform: translate3d(-1px, 3px, 0);
      }
      40%, 60% {
        transform: translate3d(-3px, -2px, 0);
      }
      50% {
        transform: translate3d(4px, -2px, 0);
      }
    }

    @keyframes shaking-top {
      10%, 90% {
        transform: translate3d(-1px, 1px, 0);
      }
      20%, 80% {
        transform: translate3d(4px, -1px, 0);
      }
      25%, 75% {
        transform: translate3d(1px, -3px, 0);
      }
      30%, 70% {
        transform: translate3d(-3px, -3px, 0);
      }
      35%, 65% {
        transform: translate3d(1px, 4px, 0);
      }
      40%, 60% {
        transform: translate3d(-4px, 1px, 0);
      }
      50% {
        transform: translate3d(0px, -2px, 0);
      }
    }

    .logo-part-left-con {
      transform: rotate(30deg);
      animation: trans-part-left .8s 1s forwards;
    }

    @keyframes trans-part-left {
      to {
        transform: rotate(7deg);
      }
    }

    .logo-part-left {
      background-color: #59d6d2;
      transform: skewX(30deg);
    }

    .logo-part-right-con {
      transform: rotate(90deg);
      height: 96px;
      width: 112px;
      margin-left: 2px;
      margin-top: 2px;
    }

    .logo-part-right {
      background-color: #2F3240;
      transform: skewX(30deg);
    }

    .logo-part-top-con {
      transform: rotate(150deg);
      animation: trans-part-top .8s 1s forwards;
    }

    @keyframes trans-part-top {
      to {
        transform: rotate(50deg);
      }
    }

    .logo-part-top {
      background-color: #2F3240;
      transform: skewX(30deg);
    }
  `

  const styleElement = document.createElement('style')
  styleElement.textContent = styleText
  return styleElement
}

class MicroAppLoading extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({ mode: 'open' })
  }

  connectedCallback() {
    this.shadowRoot.appendChild(getStyle(this.getAttribute('size') || 1))
    const container = document.createElement('div')
    container.setAttribute('class',  'micro-app-logo')
    container.innerHTML = `
      <div class="logo-container">
        <div class="logo-common-con logo-common-con-left">
          <div class="logo-common-part-con logo-part-left-con">
            <div class="logo-common-part logo-part-left"></div>
          </div>
        </div>
        <div class="logo-common-con logo-common-con-right">
          <div class="logo-common-part-con logo-part-right-con">
            <div class="logo-common-part logo-part-right"></div>
          </div>
        </div>
        <div class="logo-common-con logo-common-con-top">
          <div class="logo-common-part-con logo-part-top-con">
            <div class="logo-common-part logo-part-top"></div>
          </div>
        </div>
      </div>
    `
    this.shadowRoot.appendChild(container)
  }
}

if (!customElements.get('micro-app-loading')) {
  customElements.define('micro-app-loading', MicroAppLoading)
}
