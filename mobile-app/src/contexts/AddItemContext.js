import React, { createContext, useContext, useRef } from 'react'

const AddItemContext = createContext()

export const AddItemProvider = ({ children }) => {
  const callbackRef = useRef(null)
  
  const setItemSelectCallback = (callback) => {
    callbackRef.current = callback
  }
  
  const callItemSelect = (item) => {
    if (callbackRef.current) {
      callbackRef.current(item)
      callbackRef.current = null
    }
  }
  
  return (
    <AddItemContext.Provider value={{ setItemSelectCallback, callItemSelect }}>
      {children}
    </AddItemContext.Provider>
  )
}

export const useAddItem = () => {
  const context = useContext(AddItemContext)
  if (!context) {
    throw new Error('useAddItem must be used within AddItemProvider')
  }
  return context
}