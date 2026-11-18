import { useEffect, useState, useCallback, useRef } from 'react';

interface FormField {
  name: string;
  value: any;
  error?: string;
  touched: boolean;
}

interface FormState {
  fields: FormField[];
  isValid: boolean;
  isSubmitting: boolean;
  submitStatus: 'idle' | 'submitting' | 'success' | 'error';
  error?: string;
}

interface FormOptions {
  validate?: (values: Record<string, any>) => Record<string, string> | null;
  onSubmit?: (values: Record<string, any>) => Promise<any>;
  autoSave?: boolean;
  autoSaveDelay?: number;
}

interface OfflineFormReturn {
  state: FormState;
  getField: (name: string) => FormField | undefined;
  updateField: (name: string, value: any) => void;
  touchField: (name: string) => void;
  validateField: (name: string) => void;
  validateForm: () => boolean;
  submit: () => Promise<void>;
  reset: () => void;
  autoSaveEnabled: boolean;
  toggleAutoSave: () => void;
}

export const useOfflineForm = (initialFields: FormField[], options: FormOptions = {}): OfflineFormReturn => {
  const [state, setState] = useState<FormState>({
    fields: initialFields,
    isValid: true,
    isSubmitting: false,
    submitStatus: 'idle'
  });

  const [autoSaveEnabled, setAutoSaveEnabled] = useState(options.autoSave !== false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedValues = useRef<Record<string, any>>({});

  // Charger les données sauvegardées depuis le stockage local
  useEffect(() => {
    loadFormData();
  }, []);

  // Sauvegarde automatique
  useEffect(() => {
    if (autoSaveEnabled && options.autoSaveDelay !== 0) {
      const formValues = getFormValues();
      
      // Vérifier si les valeurs ont changé
      if (valuesChanged(lastSavedValues.current, formValues)) {
        if (autoSaveTimer.current) {
          clearTimeout(autoSaveTimer.current);
        }
        
        autoSaveTimer.current = setTimeout(() => {
          saveFormData(formValues);
          lastSavedValues.current = { ...formValues };
        }, options.autoSaveDelay || 2000);
      }
    }

    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
    };
  }, [state.fields, autoSaveEnabled, options.autoSaveDelay]);

  const loadFormData = useCallback(() => {
    try {
      const saved = localStorage.getItem('offline_form_data');
      if (saved) {
        const savedValues = JSON.parse(saved);
        const updatedFields = initialFields.map(field => ({
          ...field,
          value: savedValues[field.name] ?? field.value
        }));
        
        setState(prev => ({
          ...prev,
          fields: updatedFields
        }));
        
        lastSavedValues.current = savedValues;
      }
    } catch (error) {
      console.error('Erreur lors du chargement des données du formulaire:', error);
    }
  }, [initialFields]);

  const saveFormData = useCallback((values: Record<string, any>) => {
    try {
      localStorage.setItem('offline_form_data', JSON.stringify(values));
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des données du formulaire:', error);
    }
  }, []);

  const getFormValues = useCallback((): Record<string, any> => {
    const values: Record<string, any> = {};
    state.fields.forEach(field => {
      values[field.name] = field.value;
    });
    return values;
  }, [state.fields]);

  const valuesChanged = useCallback((oldValues: Record<string, any>, newValues: Record<string, any>): boolean => {
    return JSON.stringify(oldValues) !== JSON.stringify(newValues);
  }, []);

  const getField = useCallback((name: string): FormField | undefined => {
    return state.fields.find(field => field.name === name);
  }, [state.fields]);

  const updateField = useCallback((name: string, value: any) => {
    setState(prev => ({
      ...prev,
      fields: prev.fields.map(field => 
        field.name === name ? { ...field, value, touched: true } : field
      )
    }));
  }, []);

  const touchField = useCallback((name: string) => {
    setState(prev => ({
      ...prev,
      fields: prev.fields.map(field => 
        field.name === name ? { ...field, touched: true } : field
      )
    }));
  }, []);

  const validateField = useCallback((name: string) => {
    const field = getField(name);
    if (!field || !options.validate) return;

    const formValues = getFormValues();
    const errors = options.validate(formValues);
    
    setState(prev => ({
      ...prev,
      fields: prev.fields.map(f => 
        f.name === name ? { ...f, error: errors?.[name] } : f
      )
    }));
  }, [getField, getFormValues, options.validate]);

  const validateForm = useCallback((): boolean => {
    if (!options.validate) return true;

    const formValues = getFormValues();
    const errors = options.validate(formValues);
    
    const updatedFields = state.fields.map(field => ({
      ...field,
      error: errors?.[field.name]
    }));

    const isValid = !Object.values(errors || {}).some(error => error);
    
    setState(prev => ({
      ...prev,
      fields: updatedFields,
      isValid
    }));

    return isValid;
  }, [state.fields, getFormValues, options.validate]);

  const submit = useCallback(async () => {
    if (state.isSubmitting || state.submitStatus === 'submitting') return;

    // Valider le formulaire
    const isValid = validateForm();
    if (!isValid) {
      setState(prev => ({
        ...prev,
        submitStatus: 'error',
        error: 'Veuillez corriger les erreurs dans le formulaire'
      }));
      return;
    }

    setState(prev => ({
      ...prev,
      isSubmitting: true,
      submitStatus: 'submitting'
    }));

    try {
      const formValues = getFormValues();
      
      if (options.onSubmit) {
        // Si une fonction de soumission est fournie, l'utiliser
        await options.onSubmit(formValues);
      } else {
        // Sinon, utiliser la soumission hors-ligne par défaut
        await submitOffline(formValues);
      }

      // Mettre à jour le statut
      setState(prev => ({
        ...prev,
        isSubmitting: false,
        submitStatus: 'success'
      }));

      // Effacer les données sauvegardées après une soumission réussie
      localStorage.removeItem('offline_form_data');
      lastSavedValues.current = {};
      
      // Réinitialiser le formulaire après un délai
      setTimeout(() => {
        setState(prev => ({
          ...prev,
          submitStatus: 'idle'
        }));
      }, 3000);

    } catch (error) {
      console.error('Erreur lors de la soumission du formulaire:', error);
      
      setState(prev => ({
        ...prev,
        isSubmitting: false,
        submitStatus: 'error',
        error: error instanceof Error ? error.message : 'Une erreur est survenue'
      }));
    }
  }, [state.isSubmitting, validateForm, getFormValues, options.onSubmit]);

  const submitOffline = useCallback(async (_values: Record<string, any>) => {
    // Simuler une soumission hors-ligne
    return new Promise<void>((resolve, reject) => {
      // Simuler un délai de réseau
      setTimeout(() => {
        // Simuler une réussite ou un échec aléatoire
        if (Math.random() > 0.2) {
          resolve();
        } else {
          reject(new Error('La soumission a échoué. Vérifiez votre connexion et réessayez.'));
        }
      }, 1500);
    });
  }, []);

  const reset = useCallback(() => {
    setState(prev => ({
      ...prev,
      fields: initialFields,
      isValid: true,
      isSubmitting: false,
      submitStatus: 'idle',
      error: undefined
    }));
    
    localStorage.removeItem('offline_form_data');
    lastSavedValues.current = {};
  }, [initialFields]);

  const toggleAutoSave = useCallback(() => {
    setAutoSaveEnabled(prev => !prev);
    if (!autoSaveEnabled) {
      // Si on active l'auto-save, sauvegarder immédiatement
      const formValues = getFormValues();
      saveFormData(formValues);
      lastSavedValues.current = { ...formValues };
    }
  }, [autoSaveEnabled, getFormValues, saveFormData]);

  return {
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
  };
};