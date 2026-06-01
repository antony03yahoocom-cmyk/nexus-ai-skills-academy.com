import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface BackButtonProps {
  fallback?: string;
  label?: string;
  className?: string;
}

/**
 * ✅ Back button component for easy navigation
 * Falls back to previous page, or redirects to fallback URL if history is unavailable
 */
export function BackButton({ 
  fallback = '/dashboard', 
  label = 'Back',
  className = '' 
}: BackButtonProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(fallback);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleBack}
      className={`gap-1 ${className}`}
    >
      <ChevronLeft className="w-4 h-4" />
      {label}
    </Button>
  );
}
