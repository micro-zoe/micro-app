// @ts-ignore
import { MicroLocation } from '@micro-app/types'
import { initGlobalEnv } from '../../../libs/global_env'

initGlobalEnv();
// 直接在 jest 里调用会 TypeError: Class constructor URL cannot be invoked without 'new'
jest.mock('../../../libs/utils', () => {
  const originalModule = jest.requireActual('../../../libs/utils');

  return {
    __esModule: true,
    ...originalModule,
    createURL: (function (): (path: string | URL, base?: string) => MicroLocation {
      const Location = URL
      return (path: string | URL, base?: string): MicroLocation => {
        // @ts-ignore
        return (base ? new Location('' + path, base) : new Location('' + path)) as MicroLocation
      }
    })()
  };
});
