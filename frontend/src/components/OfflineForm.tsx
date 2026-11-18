import React, { useEffect, useRef, useState } from 'react';
import { useOfflineForm } from '../hooks/useOfflineForm';

interface OfflineFormProps {
  fields: Array<{
    name: string;
    label: string;
    type: string;
    placeholder?: string;
    required?: boolean;
    options?: Array<{ value: string; label: string }>;
    validation?: (value: any) => string | null;
  }>;
  onSubmit?: (values: Record<string, any>) => Promise<any>;
  onFormSubmit?: (result: { success: boolean }) => void;
  className?: string;
  autoSave?: boolean;
  showAutoSaveToggle?: boolean;
  submitButtonText?: string;
  submittingText?: string;
}

const OfflineForm: React.FC<OfflineFormProps> = ({
  fields,
  onSubmit,
  onFormSubmit,
  className = '',
  autoSave = true,
  showAutoSaveToggle = true,
  submitButtonText = 'Envoyer',
  submittingText = 'Envoi en cours...'
}) => {
  const { 
    state, 
    getField, 
    updateField, 
    touchField, 
    validateField, 
    validateForm, 
    submit, 
    reset,
    autoSaveEnabled,
    toggleAutoSave
  } = useOfflineForm(
    fields.map(field => ({
      name: field.name,
      value: '',
      touched: false
    })),
    {
      validate: (values) => {
        const errors: Record<string, string> = {};
        
        fields.forEach(field => {
          if (field.required && !values[field.name]) {
            errors[field.name] = `${field.label} est requis`;
          }
          
          if (field.validation) {
            const validationError = field.validation(values[field.name]);
            if (validationError) {
              errors[field.name] = validationError;
            }
          }
        });
        
        return Object.keys(errors).length > 0 ? errors : null;
      },
      onSubmit,
      autoSave
    }
  );

  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);

  // Gérer l'affichage des messages de succès/erreur
  const onFormSubmitRef = useRef(onFormSubmit);
  onFormSubmitRef.current = onFormSubmit;

  useEffect(() => {
    if (state.submitStatus === 'success') {
      onFormSubmitRef.current?.({ success: true });
      setShowSuccess(true);
      const timer = setTimeout(() => {
        setShowSuccess(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
    
    if (state.submitStatus === 'error') {
      onFormSubmitRef.current?.({ success: false });
      setShowError(true);
      const timer = setTimeout(() => {
        setShowError(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [state.submitStatus]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Valider tous les champs
    fields.forEach(field => {
      touchField(field.name);
      validateField(field.name);
    });
    
    // Valider le formulaire
    const isValid = validateForm();
    if (!isValid) {
      return;
    }
    
    try {
      await submit();
    } catch (error) {
      console.error('Erreur lors de la soumission:', error);
    }
  };

  const handleReset = () => {
    reset();
    setShowSuccess(false);
    setShowError(false);
  };

  const renderField = (field: OfflineFormProps['fields'][number]) => {
    const fieldValue = getField(field.name);
    if (!fieldValue) return null;

    const commonProps = {
      id: field.name,
      name: field.name,
      value: fieldValue.value,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        updateField(field.name, e.target.value);
        touchField(field.name);
        if (field.validation) {
          validateField(field.name);
        }
      },
      onBlur: () => touchField(field.name),
      className: `form-control ${fieldValue.touched && fieldValue.error ? 'is-invalid' : ''}`,
      placeholder: field.placeholder || ''
    };

    switch (field.type) {
      case 'textarea':
        return (
          <textarea
            {...commonProps}
            rows={3}
          />
        );
      
      case 'select':
        return (
          <select {...commonProps}>
            <option value="">{field.placeholder || 'Sélectionner une option'}</option>
            {field.options?.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );
      
      case 'checkbox':
        return (
          <div className="checkbox-wrapper">
            <input
              type="checkbox"
              id={field.name}
              name={field.name}
              checked={fieldValue.value}
              onChange={(e) => updateField(field.name, e.target.checked)}
              className="form-checkbox"
            />
            <label htmlFor={field.name}>{field.label}</label>
          </div>
        );
      
      case 'radio':
        return (
          <div className="radio-group">
            {field.options?.map(option => (
              <div key={option.value} className="radio-option">
                <input
                  type="radio"
                  id={`${field.name}-${option.value}`}
                  name={field.name}
                  value={option.value}
                  checked={fieldValue.value === option.value}
                  onChange={(e) => updateField(field.name, e.target.value)}
                  className="form-radio"
                />
                <label htmlFor={`${field.name}-${option.value}`}>{option.label}</label>
              </div>
            ))}
          </div>
        );
      
      default:
        return (
          <input
            type={field.type}
            {...commonProps}
          />
        );
    }
  };

  return (
    <div className={`offline-form ${className}`}>
      {showSuccess && (
        <div className="form-success alert alert-success">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          Formulaire soumis avec succès ! Les données ont été sauvegardées.
        </div>
      )}

      {showError && state.error && (
        <div className="form-error alert alert-danger">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          {state.error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="form-content">
        {fields.map(field => {
          const fieldValue = getField(field.name);
          if (!fieldValue) return null;

          return (
            <div key={field.name} className="form-group">
              <label htmlFor={field.name}>
                {field.label}
                {field.required && <span className="required">*</span>}
              </label>
              {renderField(field)}
              {fieldValue.touched && fieldValue.error && (
                <div className="form-error-text">{fieldValue.error}</div>
              )}
            </div>
          );
        })}

        <div className="form-actions">
          <button
            type="submit"
            disabled={state.isSubmitting}
            className="btn btn-primary submit-btn"
          >
            {state.isSubmitting ? (
              <>
                <span className="spinner"></span>
                {submittingText}
              </>
            ) : (
              submitButtonText
            )}
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="btn btn-secondary reset-btn"
          >
            Réinitialiser
          </button>
        </div>

        {showAutoSaveToggle && (
          <div className="form-auto-save">
            <div className="auto-save-toggle">
              <span className="auto-save-label">
                Sauvegarde automatique: {autoSaveEnabled ? 'Activée' : 'Désactivée'}
              </span>
              <button
                type="button"
                onClick={toggleAutoSave}
                className={`toggle-switch ${autoSaveEnabled ? 'on' : 'off'}`}
              >
                <span className="switch-slider"></span>
              </button>
            </div>
            {autoSaveEnabled && (
              <div className="auto-save-info">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10"></polyline>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                </svg>
                Vos modifications sont sauvegardées automatiquement
              </div>
            )}
          </div>
        )}
      </form>
    </div>
  );
};

export default OfflineForm;