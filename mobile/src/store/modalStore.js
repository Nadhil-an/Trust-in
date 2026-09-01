import { create } from 'zustand';

export const useModalStore = create((set) => ({
  visible: false,
  title: '',
  message: '',
  actionTitle: '',
  onConfirm: null,
  showModal: (title, message, actionTitle, onConfirm) => 
    set({ visible: true, title, message, actionTitle, onConfirm }),
  hideModal: () => set({ visible: false })
}));
