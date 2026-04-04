import { useState, useEffect } from 'react';
import { subscribeToRequirements, RequirementsConfig } from '../services/requirementsService';
import { FIELD_LABELS as DEFAULT_FIELDS, DOCUMENT_LABELS as DEFAULT_DOCS } from '../constants/processRequirements';

export const useRequirements = () => {
  const [config, setConfig] = useState<RequirementsConfig>({
    field_labels: DEFAULT_FIELDS,
    document_labels: DEFAULT_DOCS
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToRequirements((newConfig) => {
      setConfig(newConfig);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return { config, loading };
};
