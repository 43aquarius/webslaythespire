// zustand 兼容垫片（仅实现本项目用到的 API）
export function create(fn: any) {
  let state: any
  const listeners = new Set<() => void>()
  const setState = (partial: any) => {
    const next = typeof partial === 'function' ? partial(state) : partial
    state = { ...state, ...next }
    listeners.forEach((l: any) => l(state))
  }
  const getState = () => state
  const subscribe = (l: any) => {
    listeners.add(l)
    return () => listeners.delete(l)
  }
  state = fn(setState, getState)
  const hook: any = (selector?: any) => (selector ? selector(state) : state)
  hook.getState = getState
  hook.setState = setState
  hook.subscribe = subscribe
  return hook
}
