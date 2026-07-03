import Swal from "sweetalert2";

// Shared confirmation dialog so every "are you sure?" prompt in the app
// (delete student, delete account, etc.) looks and behaves the same way,
// instead of each screen picking its own styling or falling back to
// window.confirm().
export function confirmAction({
  title = "Are you sure?",
  text = "",
  confirmText = "Yes, continue",
  cancelText = "Cancel",
  danger = false,
} = {}) {
  return Swal.fire({
    title,
    text,
    icon: danger ? "warning" : "question",
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    reverseButtons: true,
    focusCancel: true,
    buttonsStyling: false,
    customClass: {
      popup: "sms-swal-popup",
      title: "sms-swal-title",
      htmlContainer: "sms-swal-text",
      icon: `sms-swal-icon ${danger ? "sms-swal-icon--danger" : ""}`,
      confirmButton: `sms-swal-btn ${danger ? "sms-swal-btn--danger" : "sms-swal-btn--primary"}`,
      cancelButton: "sms-swal-btn sms-swal-btn--cancel",
    },
  }).then((result) => result.isConfirmed);
}

export function confirmDelete(itemLabel) {
  return confirmAction({
    title: "Delete this?",
    text: itemLabel
      ? `"${itemLabel}" will be permanently deleted. This action cannot be undone.`
      : "This action cannot be undone.",
    confirmText: "Yes, delete it",
    danger: true,
  });
}
