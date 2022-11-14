import './setup'
import createMicroRouter, {
  initRouteStateWithURL,
  updateBrowserURLWithLocation,
  clearRouteStateFromURL,
} from '../../../sandbox/router'
import * as LocationUtil from '../../../sandbox/router/location'
import * as CoreUtil from '../../../sandbox/router/core'
import * as HistoryApi from '../../../sandbox/router/history'

const updateMicroLocation = jest.fn()
jest.spyOn(LocationUtil,'updateMicroLocation').mockImplementation(updateMicroLocation)
const autoTriggerNavigationGuard = jest.spyOn(LocationUtil,'autoTriggerNavigationGuard')
const getMicroPathFromURL = jest.spyOn(CoreUtil,'getMicroPathFromURL')
const attachRouteToBrowserURL = jest.spyOn(HistoryApi,'attachRouteToBrowserURL')

describe("router",() => {
  const appName = 'router'
  const url = 'http://www.abc.com/def'

  afterAll(() => {
    clearRouteStateFromURL(appName,url,{} as any,false)
  })

  test("createMicroRouter",() => {
    const router = createMicroRouter(appName,url)
    expect(router).toMatchObject({
      microHistory: expect.anything(),
      microLocation: expect.anything()
    })
  })

  test("initRouteStateWithURL",() => {
    initRouteStateWithURL(appName,{} as any,'/home')
    expect(updateMicroLocation).toBeCalledWith(appName,"/home", {}, "prevent")
  })

  test("initRouteStateWithURL with microPath",() => {
    getMicroPathFromURL.mockReturnValue('/abc')

    initRouteStateWithURL(appName,{} as any,'/home')
    expect(updateMicroLocation).toBeCalledWith(appName,"/abc", {}, "auto")
    getMicroPathFromURL.mockClear()
  })

  test("updateBrowserURLWithLocation",() => {
    updateBrowserURLWithLocation(appName,{} as any,)
    expect(updateMicroLocation).not.toBeCalled();
    expect(attachRouteToBrowserURL).toBeCalledWith(appName,{
      fullPath: `/?${appName}=NaN`,
      isAttach2Hash: false
    }, {
      microAppState: {
        router: null
      }
    })
    expect(autoTriggerNavigationGuard).toBeCalledWith(appName,{})
  })

  test("updateBrowserURLWithLocation with defaultPage",() => {
    updateBrowserURLWithLocation(appName,{} as any,'/home')
    expect(updateMicroLocation).toBeCalledWith(appName,"/home", {}, "prevent")
  })
})
