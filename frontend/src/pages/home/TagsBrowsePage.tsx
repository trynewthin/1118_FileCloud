import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export const TagsBrowsePage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/files?virtual=tags", { replace: true });
  }, [navigate]);

  return null;
};
