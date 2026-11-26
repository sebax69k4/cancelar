-- CreateEnum
CREATE TYPE "RolPlataforma" AS ENUM ('MODERADOR', 'ADMINISTRADOR');

-- AlterTable
ALTER TABLE "Taller" ADD COLUMN     "motivoSuspension" TEXT,
ADD COLUMN     "suspendido" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "suspendidoEn" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CuentaPlataforma" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" "RolPlataforma" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "totpSecreto" TEXT,
    "totpActivo" BOOLEAN NOT NULL DEFAULT false,
    "totpUltimoPaso" INTEGER,
    "sesionesDesde" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CuentaPlataforma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccionPlataforma" (
    "id" TEXT NOT NULL,
    "cuentaId" TEXT,
    "accion" TEXT NOT NULL,
    "tallerId" INTEGER,
    "usuarioId" TEXT,
    "detalle" TEXT,
    "ip" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccionPlataforma_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CuentaPlataforma_email_key" ON "CuentaPlataforma"("email");

-- CreateIndex
CREATE INDEX "AccionPlataforma_fecha_idx" ON "AccionPlataforma"("fecha");

-- CreateIndex
CREATE INDEX "AccionPlataforma_tallerId_idx" ON "AccionPlataforma"("tallerId");

-- AddForeignKey
ALTER TABLE "AccionPlataforma" ADD CONSTRAINT "AccionPlataforma_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "CuentaPlataforma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- La bitácora no se puede modificar ni borrar, ni siquiera desde la aplicación
CREATE FUNCTION "bitacora_inmutable"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'La bitácora de la plataforma no se puede modificar ni borrar';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AccionPlataforma_inmutable"
  BEFORE UPDATE OR DELETE ON "AccionPlataforma"
  FOR EACH ROW EXECUTE FUNCTION "bitacora_inmutable"();
