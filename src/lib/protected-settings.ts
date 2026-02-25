export type BooleanSettingEventDetail = {
  enabled: boolean
}

export const DYNAMIC_BACKGROUND_STORAGE_KEY = 'protected-dynamic-background'
export const DYNAMIC_BACKGROUND_EVENT = 'protected:dynamic-background'

export function readStoredBoolean(settingKey: string, defaultValue: boolean): boolean {
  if (typeof window === 'undefined') {
    return defaultValue
  }

  try {
    const storedValue = window.localStorage.getItem(settingKey)
    if (storedValue === null) {
      return defaultValue
    }

    return storedValue === 'true'
  } catch {
    return defaultValue
  }
}

export function storeBoolean(settingKey: string, nextValue: boolean) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(settingKey, String(nextValue))
  } catch {
    // Ignore storage failures and fall back to in-memory state.
  }
}

export function emitBooleanSetting(eventName: string, nextValue: boolean) {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(
    new CustomEvent<BooleanSettingEventDetail>(eventName, {
      detail: { enabled: nextValue },
    })
  )
}
