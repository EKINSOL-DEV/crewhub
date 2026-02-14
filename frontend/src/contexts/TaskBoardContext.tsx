import { createContext, useContext, useCallback, useMemo, type ReactNode } from 'react'

interface TaskBoardContextValue {
  openTaskBoard: () => void
}

const TaskBoardContext = createContext<TaskBoardContextValue>({
  openTaskBoard: () => {},
})

interface TaskBoardProviderProps {
  children: ReactNode
  onOpen: () => void
}

export function TaskBoardProvider({ children, onOpen }: TaskBoardProviderProps) {
  const openTaskBoard = useCallback(() => {
    onOpen()
  }, [onOpen])

  const value = useMemo(() => ({ openTaskBoard }), [openTaskBoard])

  return (
    <TaskBoardContext.Provider value={value}>
      {children}
    </TaskBoardContext.Provider>
  )
}

export function useTaskBoard() {
  return useContext(TaskBoardContext)
}
