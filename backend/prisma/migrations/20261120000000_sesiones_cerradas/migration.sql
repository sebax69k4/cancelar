-- Sesiones cerradas antes de vencer (logout): el token con ese jti deja de valer
CREATE TABLE "SesionCerrada" (
    "jti" TEXT NOT NULL,
    "expira" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SesionCerrada_pkey" PRIMARY KEY ("jti")
);

CREATE INDEX "SesionCerrada_expira_idx" ON "SesionCerrada"("expira");
