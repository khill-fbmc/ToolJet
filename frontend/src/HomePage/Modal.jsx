import React from 'react';
import { default as BootstrapModal } from 'react-bootstrap/Modal';

export default function Modal({
  title,
  titleAdornment,
  show,
  closeModal,
  customClassName,
  children,
  footerContent = null,
  headerContent = null,
  size = 'sm',
  closeButton = true,
}) {
  const darkMode = localStorage.getItem('darkMode') === 'true';
  const modalFooter = footerContent ? (
    <BootstrapModal.Footer className={`modal-divider ${darkMode ? 'dark-theme-modal-divider' : ''}`}>
      {footerContent}
    </BootstrapModal.Footer>
  ) : null;
  return (
    <BootstrapModal
      onHide={() => closeModal(false)}
      contentClassName={`home-modal-component animation-fade${customClassName ? ` ${customClassName}` : ''} ${
        darkMode && 'dark-theme'
      }`}
      dialogClassName="custom-modal-width"
      show={show}
      size={size}
      backdrop={true}
      keyboard={true}
      enforceFocus={false}
      animation={false}
      onEscapeKeyDown={() => closeModal()}
      centered
      data-cy={'modal-component'}
    >
      <BootstrapModal.Header>
        {typeof title === 'string' ? (
          <BootstrapModal.Title data-cy={`${title.toLowerCase().replace(/\s+/g, '-')}-title`}>
            {title}
            {titleAdornment}
          </BootstrapModal.Title>
        ) : (
          title
        )}
        {headerContent && <div>{headerContent}</div>}
        {closeButton && (
          <button
            className="btn-close"
            aria-label="Close"
            onClick={() => closeModal()}
            data-cy="modal-close-button"
          ></button>
        )}
      </BootstrapModal.Header>
      <BootstrapModal.Body className="modal-body-scrollable">{children}</BootstrapModal.Body>
      {modalFooter ? modalFooter : <></>}
    </BootstrapModal>
  );
}
