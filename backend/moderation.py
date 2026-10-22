"""
Módulo de Moderação Automática de Conteúdo de Imagens do Pontinho UFABC
Utiliza:
1. NudeNet (ONNX local): Detecção anatômica granular
   - PROIBIDO: Genitálias masculinas/femininas e ânus exposto
   - PERMITIDO: Seios femininos/tórax adulto (FEMALE_BREAST_EXPOSED)
2. InsightFace GenderAge (ONNX local, ~1.3MB):
   - PROIBIDO: Menores de idade (< 18 anos)
"""
import os
import cv2
import numpy as np
from pathlib import Path
from typing import Dict, Any, List

MODELS_DIR = Path(__file__).resolve().parent / "models"
GENDERAGE_MODEL_PATH = MODELS_DIR / "genderage.onnx"

class ImageContentModerator:
    _instance = None
    _nude_detector = None
    _age_session = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _get_nude_detector(self):
        if self._nude_detector is None:
            from nudenet import NudeDetector
            self._nude_detector = NudeDetector()
        return self._nude_detector

    def _get_age_session(self):
        if self._age_session is None and GENDERAGE_MODEL_PATH.exists():
            import onnxruntime as ort
            self._age_session = ort.InferenceSession(
                str(GENDERAGE_MODEL_PATH),
                providers=["CPUExecutionProvider"]
            )
        return self._age_session

    def moderate_image(self, image_path: str) -> Dict[str, Any]:
        """
        Analisa uma imagem salva em disco e aplica as regras:
        - Genitálias são estritamente proibidas
        - Seios são permitidos
        - Menores de idade (< 18) são proibidos
        """
        path_obj = Path(image_path)
        if not path_obj.exists():
            return {"allowed": True, "info": "Arquivo não encontrado para análise prévia."}

        # 1. Detecção anatômica e de faces via NudeNet
        try:
            detector = self._get_nude_detector()
            detections = detector.detect(str(path_obj))
        except Exception as e:
            # Fallback seguro caso detector falhe na leitura
            print(f"[Moderation] Erro ao executar NudeNet: {e}")
            return {"allowed": True, "warning": "Falha na análise automática de anatomia."}

        # Regra 1: Genitálias são proibidas (Seios femininos são explicitamente PERMITIDOS)
        FORBIDDEN_GENITALIA = {
            "FEMALE_GENITALIA_EXPOSED",
            "MALE_GENITALIA_EXPOSED",
            "ANUS_EXPOSED"
        }

        for det in detections:
            label = det.get("class", "")
            score = det.get("score", 0.0)

            # Bloqueio imediato de genitália se confiança for razoável (>= 0.40)
            if label in FORBIDDEN_GENITALIA and score >= 0.40:
                return {
                    "allowed": False,
                    "reason": "Imagem não permitida: genitálias e conteúdo sexual explícito são estritamente proibidos nas diretrizes do Pontinho.",
                    "detected_class": label,
                    "confidence": round(float(score), 2)
                }

        # Regra 2: Verificação de menor de idade nos rostos detectados
        age_session = self._get_age_session()
        face_boxes: List[List[int]] = []

        for det in detections:
            label = det.get("class", "")
            score = det.get("score", 0.0)
            if label in ("FACE_FEMALE", "FACE_MALE") and score >= 0.35:
                face_boxes.append(det.get("box", []))

        if age_session and face_boxes:
            try:
                img_cv = cv2.imread(str(path_obj))
                if img_cv is not None:
                    img_h, img_w = img_cv.shape[:2]
                    for box in face_boxes:
                        if len(box) != 4:
                            continue
                        x, y, w, h = box
                        # Expande a margem em 15% para englobar queixo e testa
                        pad_w = int(w * 0.15)
                        pad_h = int(h * 0.15)
                        x1 = max(0, x - pad_w)
                        y1 = max(0, y - pad_h)
                        x2 = min(img_w, x + w + pad_w)
                        y2 = min(img_h, y + h + pad_h)

                        if x2 - x1 < 20 or y2 - y1 < 20:
                            continue

                        face_crop = img_cv[y1:y2, x1:x2]
                        if face_crop.size == 0:
                            continue

                        face_resized = cv2.resize(face_crop, (96, 96))
                        face_blob = cv2.cvtColor(face_resized, cv2.COLOR_BGR2RGB).astype(np.float32)
                        face_blob = np.transpose(face_blob, (2, 0, 1))
                        face_blob = np.expand_dims(face_blob, axis=0)

                        out = age_session.run(None, {"data": face_blob})[0]
                        # out[0][2] representa a idade escalada por 100
                        estimated_age = int(round(float(out[0][2]) * 100))

                        # Limite legal de maioridade
                        if estimated_age < 18:
                            return {
                                "allowed": False,
                                "reason": f"Imagem não permitida: o Pontinho é exclusivo para maiores de 18 anos. Detectada feição de menor de idade (~{estimated_age} anos).",
                                "estimated_age": estimated_age
                            }
            except Exception as e:
                print(f"[Moderation] Erro ao estimar idade facial: {e}")

        return {
            "allowed": True,
            "detections_count": len(detections),
            "faces_evaluated": len(face_boxes)
        }

# Função utilitária de conveniência
def check_image_safety(image_path: str) -> Dict[str, Any]:
    moderator = ImageContentModerator.get_instance()
    return moderator.moderate_image(image_path)
