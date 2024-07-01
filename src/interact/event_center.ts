/* eslint-disable no-cond-assign */
import { CallableFunctionForInteract, AppName } from '@micro-app/types'
import { logError, isFunction, isPlainObject, assign, defer } from '../libs/utils'
import microApp from '../micro_app'

export default class EventCenter {
  public eventList = new Map<string, {
    data: Record<PropertyKey, unknown>,
    tempData?: Record<PropertyKey, unknown> | null,
    force?: boolean,
    callbacks: Set<CallableFunctionForInteract>,
  }>()

  // whether the name is legal
  private isLegalName (name: string): boolean {
    if (!name) {
      logError('event-center: Invalid name')
      return false
    }

    return true
  }

  private queue: string[] = []
  private recordStep: Record<string, {
    nextStepList: Array<CallableFunction>,
    dispatchDataEvent?: CallableFunction,
  } | null> = {}

  // add appName to queue
  private enqueue (
    name: AppName,
    nextStep: CallableFunction,
    dispatchDataEvent?: CallableFunction,
  ): void {
    // this.nextStepList.push(nextStep)
    if (this.recordStep[name]) {
      this.recordStep[name]!.nextStepList.push(nextStep)
      dispatchDataEvent && (this.recordStep[name]!.dispatchDataEvent = dispatchDataEvent)
    } else {
      this.recordStep[name] = {
        nextStepList: [nextStep],
        dispatchDataEvent,
      }
    }
    /**
     * The micro task is executed async when the second render of child.
     * We should ensure that the data changes are executed before binding the listening function
     */
    (!this.queue.includes(name) && this.queue.push(name) === 1) && defer(this.process)
  }

  // run task
  private process = (): void => {
    let name: string | void
    const temRecordStep = this.recordStep
    const queue = this.queue
    this.recordStep = {}
    this.queue = []
    while (name = queue.shift()) {
      const eventInfo = this.eventList.get(name)!
      // clear tempData, force before exec nextStep
      const tempData = eventInfo.tempData
      const force = eventInfo.force
      eventInfo.tempData = null
      eventInfo.force = false
      let resArr: unknown[]
      if (force || !this.isEqual(eventInfo.data, tempData)) {
        eventInfo.data = tempData || eventInfo.data
        for (const f of eventInfo.callbacks) {
          const res = f(eventInfo.data)
          res && (resArr ??= []).push(res)
        }

        temRecordStep[name]!.dispatchDataEvent?.()

        /**
         * WARING:
         * If data of other app is sent in nextStep, it may cause confusion of tempData and force
         */
        temRecordStep[name]!.nextStepList.forEach((nextStep) => nextStep(resArr))
      }
    }
  }

  /**
   * In react, each setState will trigger setData, so we need a filter operation to avoid repeated trigger
   */
  private isEqual (
    oldData: Record<PropertyKey, unknown>,
    newData: Record<PropertyKey, unknown> | null | void,
  ): boolean {
    if (!newData || Object.keys(oldData).length !== Object.keys(newData).length) return false

    for (const key in oldData) {
      if (Object.prototype.hasOwnProperty.call(oldData, key)) {
        if (oldData[key] !== newData[key]) return false
      }
    }

    return true
  }

  /**
   * add listener
   * @param name event name
   * @param f listener
   * @param autoTrigger If there is cached data when first bind listener, whether it needs to trigger, default is false
   */
  public on (name: string, f: CallableFunctionForInteract, autoTrigger = false): void {
    if (this.isLegalName(name)) {
      if (!isFunction(f)) {
        return logError('event-center: Invalid callback function')
      }

      let eventInfo = this.eventList.get(name)
      if (!eventInfo) {
        eventInfo = {
          data: {},
          callbacks: new Set(),
        }
        this.eventList.set(name, eventInfo)
      } else if (
        autoTrigger &&
        Object.keys(eventInfo.data).length &&
        (
          microApp.options['event-center-legacy'] ||
          !this.queue.includes(name) ||
          this.isEqual(eventInfo.data, eventInfo.tempData)
        )
      ) {
        // auto trigger when data not null
        f(eventInfo.data)
      }

      eventInfo.callbacks.add(f)
    }
  }

  // remove listener, but the data is not cleared
  public off (
    name: string,
    f?: CallableFunctionForInteract,
  ): void {
    if (this.isLegalName(name)) {
      const eventInfo = this.eventList.get(name)
      if (eventInfo) {
        if (isFunction(f)) {
          eventInfo.callbacks.delete(f)
        } else {
          eventInfo.callbacks.clear()
        }
      }
    }
  }

  /**
   * clearData
   */
  public clearData (name: string): void {
    if (this.isLegalName(name)) {
      const eventInfo = this.eventList.get(name)
      if (eventInfo) {
        eventInfo.data = {}
      }
    }
  }

  // dispatch data
  public dispatch (
    name: string,
    data: Record<PropertyKey, unknown>,
    nextStep?: CallableFunction,
    force?: boolean,
    dispatchDataEvent?: CallableFunction,
  ): void {
    const eventCenterLegacy = microApp.options['event-center-legacy']
    if (this.isLegalName(name)) {
      if (!isPlainObject(data)) {
        return logError('event-center: data must be object')
      }

      let eventInfo = this.eventList.get(name)
      if (eventInfo) {
        if (!eventCenterLegacy) {
          eventInfo.tempData = assign({}, eventInfo.tempData || eventInfo.data, data)
          !eventInfo.force && (eventInfo.force = !!force)
        } else {
          // keep 0.x behavior
          // Update when the data is not equal
          if (eventInfo.data !== data) {
            eventInfo.data = data
            for (const f of eventInfo.callbacks) {
              f(data)
            }
          }
        }
      } else {
        eventInfo = {
          data: data,
          callbacks: new Set(),
        }
        this.eventList.set(name, eventInfo)
        /**
         * When sent data to parent, eventInfo probably does not exist, because parent may listen to datachange
         */
        !eventCenterLegacy && (eventInfo.force = true)
      }

      if (!eventCenterLegacy && nextStep) {
        // add to queue, event eventInfo is null
        this.enqueue(name, nextStep, dispatchDataEvent)
      }
    }
  }

  // get data
  public getData (name: string): Record<PropertyKey, unknown> | null {
    const eventInfo = this.eventList.get(name)
    return eventInfo?.data ?? null
  }
}
