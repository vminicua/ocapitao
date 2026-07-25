import Swal from 'sweetalert2'

const toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 2600,
  timerProgressBar: true,
})

export function showErrorAlert(title: string, text: string) {
  return Swal.fire({
    icon: 'error',
    title,
    text,
    confirmButtonText: 'Fechar',
    confirmButtonColor: '#17458c',
  })
}

export function showSuccessToast(title: string) {
  return toast.fire({
    icon: 'success',
    title,
  })
}

export function showWarningToast(title: string) {
  return toast.fire({
    icon: 'warning',
    title,
  })
}

export function showInfoAlert(title: string, html: string) {
  return Swal.fire({
    icon: 'info',
    title,
    html,
    confirmButtonText: 'OK',
    confirmButtonColor: '#17458c',
  })
}

export async function showCloudConnectDialog(
  onConnect: (password: string) => Promise<{ ok: boolean; message: string }>,
): Promise<boolean> {
  const result = await Swal.fire({
    title: 'Ligar à Cloud',
    html: '<p style="margin-bottom:8px;text-align:left">Introduza a password do servidor para abrir o túnel SSH e ligar ao MySQL remoto.</p>',
    input: 'password',
    inputPlaceholder: 'Password SSH',
    showCancelButton: true,
    confirmButtonText: 'Ligar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#17458c',
    showLoaderOnConfirm: true,
    preConfirm: async (password: string) => {
      if (!password) {
        Swal.showValidationMessage('Introduza a password SSH.')
        return undefined
      }
      try {
        const res = await onConnect(password)
        if (!res.ok) {
          Swal.showValidationMessage(res.message || 'Falha ao ligar à cloud.')
          return undefined
        }
        return res
      } catch (err) {
        Swal.showValidationMessage(err instanceof Error ? err.message : 'Erro ao comunicar com o servidor.')
        return undefined
      }
    },
    allowOutsideClick: () => !Swal.isLoading(),
  })
  return result.isConfirmed && !!result.value
}
