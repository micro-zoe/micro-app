const contentOneImg = document.querySelector('.content-one-img')
const contentTwoImg1 = document.querySelectorAll('.content-two-img-con')[0]
const contentTwoImg2 = document.querySelectorAll('.content-two-img-con')[1]

const observer1 = new IntersectionObserver(res => {
  if (res[0].intersectionRatio <= 0) return
  observer1.disconnect()
  contentOneImg.className = 'content-one-img content-one-img-show'
  const microAppCon = document.querySelector('.micro-app-con-one')
  microAppCon.className = 'micro-app-con micro-app-con-one micro-app-con-show'

  const arrowRight1 = document.querySelectorAll('.content-common-arrow-right')[0]
  arrowRight1.className = 'content-common-arrow-right content-common-arrow-right-show'

  setTimeout(() => {
    const LoadingLogo = document.createElement('micro-app-loading')
    LoadingLogo.setAttribute('size', '0.3')
    LoadingLogo.setAttribute('class', 'loading-logo')
    microAppCon.appendChild(LoadingLogo)
  }, 1100)

  // <micro-app-loading size='0.3' class="loading-logo"></micro-app-loading>
  setTimeout(() => {
    const myApp = document.createElement('micro-app')
    myApp.setAttribute('name', 'my-app1')
    myApp.setAttribute('url', `https://zeroing.jd.com/micro-app/react17/`)
    myApp.addEventListener('mounted', () => {
      microAppCon.removeChild(microAppCon.children[0])
    })
    microAppCon.appendChild(myApp)
  }, 3000)
})
observer1.observe(contentOneImg)


const observer2 = new IntersectionObserver(res => {
  if (res[0].intersectionRatio <= 0) return
  observer2.disconnect()
  contentTwoImg1.className = 'content-two-img-con content-two-img-con-show'
})
observer2.observe(contentTwoImg1)


const observer3 = new IntersectionObserver(res => {
  if (res[0].intersectionRatio <= 0) return
  observer3.disconnect()
  contentTwoImg2.className = 'content-two-img-con content-two-img-con-show'
  const microAppCon = document.querySelector('.micro-app-con-two')
  microAppCon.className = 'micro-app-con micro-app-con-two micro-app-con-show'

  const arrowRight2 = document.querySelectorAll('.content-common-arrow-right')[1]
  arrowRight2.className = 'content-common-arrow-right content-common-arrow-right-show'

  setTimeout(() => {
    const LoadingLogo = document.createElement('micro-app-loading')
    LoadingLogo.setAttribute('size', '0.3')
    LoadingLogo.setAttribute('class', 'loading-logo')
    microAppCon.appendChild(LoadingLogo)
  }, 1100)

  setTimeout(() => {
    const myApp = document.createElement('micro-app')
    myApp.setAttribute('name', 'my-app2')
    myApp.setAttribute('url', `https://zeroing.jd.com/micro-app/react17/`)
    myApp.addEventListener('mounted', () => {
      microAppCon.removeChild(microAppCon.children[0])
    })
    microAppCon.appendChild(myApp)
  }, 3000);
})
observer3.observe(contentTwoImg2)
