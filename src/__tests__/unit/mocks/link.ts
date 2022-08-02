import { sourceLinkInfo } from '@micro-app/types'

export const MOCK_CSS = `
div {
  color: red;
}
`

export const MOCK_CSS_URL = 'http://www.abc.com/common.css'
export const MOCK_ERROR_CSS_URL = 'http://www.abc.com/error.css'

export const MOCK_CSS_LINK_INFO: sourceLinkInfo = {
  code: '',
  isGlobal: false,
  placeholder: document.createComment('placeholder for link with href=common'),
}

export const MOCK_ERROR_CSS_LINK_INFO: sourceLinkInfo = {
  code: '',
  isGlobal: false,
  placeholder: document.createComment('placeholder for link with href=error'),
}
