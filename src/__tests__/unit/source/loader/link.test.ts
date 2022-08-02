import { waitFor } from '../../../common/util'
import {
  MOCK_CSS,
  MOCK_CSS_LINK_INFO,
  MOCK_CSS_URL,
  MOCK_ERROR_CSS_LINK_INFO,
  MOCK_ERROR_CSS_URL,
} from '../../mocks/link'
import { setupMockFetch } from '../../mocks/fetch'
import { LinkLoader } from '../../../../source/loader/link'
import { MOCK_APP_URL } from '../../mocks/app'
import { AppInterface } from '@micro-app/types'

const setup = (data: string) => {
  const mockFetch = (url: string) => {
    if (url === MOCK_ERROR_CSS_URL) {
      return setupMockFetch(data, true)()
    }
    return setupMockFetch(data)()
  }
  global.fetch = jest.fn().mockImplementation(mockFetch)
  const linkLoader = LinkLoader.getInstance()
  const successCb = jest.fn()
  const errorCb = jest.fn()
  const finallyCb = jest.fn()

  return {
    linkLoader,
    successCb,
    errorCb,
    finallyCb,
  }
}

describe('LinkLoader', () => {
  beforeAll(() => {
    console.error = jest.fn()
  })

  test('给定一个链接集数据，可以获取到 css 字符串', async () => {
    const { linkLoader, successCb, finallyCb } = setup(MOCK_CSS)
    const links = new Map()
    const app = {
      name: 'app-1',
      url: MOCK_APP_URL,
      source: {
        links
      }
    } as AppInterface
    links.set(MOCK_CSS_URL, MOCK_CSS_LINK_INFO)

    linkLoader.run(app, successCb, finallyCb)

    await waitFor(() => {
      expect(successCb).toBeCalledWith(MOCK_CSS_URL, MOCK_CSS_LINK_INFO, MOCK_CSS)
      expect(finallyCb).toBeCalled()
    })
  })

  test('给定一个链接集数据，里面有多个链接信息，其中有一个会发生网络错误，会执行 errorCb 回调和 finallyCb 回调', async () => {
    const { linkLoader, successCb, finallyCb } = setup(MOCK_CSS)
    const links = new Map()
    const app = {
      name: 'app-1',
      url: MOCK_APP_URL,
      source: {
        links
      }
    } as AppInterface
    links.set(MOCK_CSS_URL, MOCK_CSS_LINK_INFO)
    links.set(MOCK_ERROR_CSS_URL, MOCK_ERROR_CSS_LINK_INFO)

    linkLoader.run(app, successCb, finallyCb)

    const logError = jest.spyOn(console, 'error')
    await waitFor(() => {
      expect(logError).toBeCalled()
      expect(finallyCb).toBeCalled()
    })
  })
})
