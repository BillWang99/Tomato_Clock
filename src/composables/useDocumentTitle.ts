import { watchEffect, type Ref } from 'vue'

export function useDocumentTitle(title: Ref<string>) {
  watchEffect(() => {
    document.title = title.value
  })
}
