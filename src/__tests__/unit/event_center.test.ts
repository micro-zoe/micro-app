import EventCenter from '../../interact/event_center'

import { MOCK_EVENT_NAME, MOCK_EVENT_DATA } from './mocks/event'
import { waitFor } from '../common/util'

describe('EventCenter', () => {
  const nextStep = jest.fn()
  beforeAll(() => {
    console.error = jest.fn()
  })

  test('监听一个事件，可以成功被触发', async () => {
    const callback = jest.fn()

    const eventCenter = new EventCenter()
    eventCenter.on(MOCK_EVENT_NAME, callback)

    // 是不是不合理，这个新的事件中心？
    eventCenter.dispatch(MOCK_EVENT_NAME, MOCK_EVENT_DATA, nextStep)
    await waitFor(() => {
      expect(callback).toBeCalledWith(MOCK_EVENT_DATA)
    })
  })

  test('监听一个已移除的事件，触发不应该成功', () => {
    const callback = jest.fn()

    const eventCenter = new EventCenter()
    eventCenter.on(MOCK_EVENT_NAME, callback)

    eventCenter.off(MOCK_EVENT_NAME, callback)
    eventCenter.dispatch(MOCK_EVENT_NAME, MOCK_EVENT_DATA, nextStep)
    expect(callback).not.toBeCalled()
  })

  test('一个事件可以绑定多个函数，可以成功被触发', () => {
    const callback = jest.fn()
    const callback2 = jest.fn()

    const eventCenter = new EventCenter()
    eventCenter.on(MOCK_EVENT_NAME, callback)
    eventCenter.on(MOCK_EVENT_NAME, callback2)

    eventCenter.dispatch(MOCK_EVENT_NAME, MOCK_EVENT_DATA, nextStep)
    expect(callback).toBeCalledWith(MOCK_EVENT_DATA)
    expect(callback2).toBeCalledWith(MOCK_EVENT_DATA)
  })

  test('一个事件可以绑定多个函数，全部解绑后触发不应该成功', () => {
    const callback = jest.fn()
    const callback2 = jest.fn()

    const eventCenter = new EventCenter()
    eventCenter.on(MOCK_EVENT_NAME, callback)
    eventCenter.on(MOCK_EVENT_NAME, callback2)

    eventCenter.off(MOCK_EVENT_NAME)
    eventCenter.dispatch(MOCK_EVENT_NAME, MOCK_EVENT_DATA, nextStep)
    expect(callback).not.toBeCalled()
    expect(callback2).not.toBeCalled()
  })

  test('未绑定回调的事件支持存储数据', () => {
    const eventCenter = new EventCenter()
    eventCenter.dispatch(MOCK_EVENT_NAME, MOCK_EVENT_DATA, nextStep)
    expect(eventCenter.getData(MOCK_EVENT_NAME)).toEqual(MOCK_EVENT_DATA)
  })

  test('监听一个事件，触发的数据不是对象，应该报错', () => {
    const callback = jest.fn()
    const logError = jest.spyOn(console, 'error')

    const eventCenter = new EventCenter()
    eventCenter.on(MOCK_EVENT_NAME, callback)

    // @ts-expect-error
    eventCenter.dispatch(MOCK_EVENT_NAME, MOCK_EVENT_DATA.content)
    expect(callback).not.toBeCalled()
    expect(logError).toBeCalledWith('[micro-app] event-center: data must be object')
  })

  test('先触发一个事件，再监听，在 autoTrigger 参数为 true 时监听回调自动被触发', () => {
    const callback = jest.fn()
    const eventCenter = new EventCenter()

    eventCenter.dispatch(MOCK_EVENT_NAME, MOCK_EVENT_DATA, nextStep)
    eventCenter.on(MOCK_EVENT_NAME, callback, true)
    expect(callback).toBeCalledWith(MOCK_EVENT_DATA)
  })
})
