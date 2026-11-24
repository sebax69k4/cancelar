import { Body, Controller, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public, RequirePermission, type AuthUser } from '../auth/auth.decorators';
import { CreateServiceDto, CreateUserDto, UpdateServiceDto, UpdateTallerDto, UpdateUserDto } from './setup.dto';
import { SetupService } from './setup.service';

/** Configuración del taller: datos, personas con sus roles y servicios (solo Admin). */
@ApiTags('configuración')
@Controller('setup')
export class SetupController {
  constructor(private readonly setup: SetupService) {}

  /** Público: si ya hay talleres registrados y si el registro de talleres nuevos está abierto. */
  @Public()
  @Get('status')
  status() {
    return this.setup.status();
  }

  /** El taller del usuario: si ya terminó la configuración inicial. */
  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.setup.mine(user);
  }

  @Get('progress')
  @RequirePermission('users.manage')
  progress(@CurrentUser() user: AuthUser) {
    return this.setup.progress(user);
  }

  @Patch('taller')
  @RequirePermission('users.manage')
  updateTaller(@CurrentUser() user: AuthUser, @Body() dto: UpdateTallerDto) {
    return this.setup.updateTaller(user, dto);
  }

  /** 422 con `details` si falta cubrir algún rol esencial o no hay servicios. */
  @Post('complete')
  @HttpCode(200)
  @RequirePermission('users.manage')
  complete(@CurrentUser() user: AuthUser) {
    return this.setup.complete(user);
  }

  @Get('users')
  @RequirePermission('users.manage')
  users(@CurrentUser() user: AuthUser) {
    return this.setup.listUsers(user);
  }

  @Post('users')
  @RequirePermission('users.manage')
  createUser(@CurrentUser() user: AuthUser, @Body() dto: CreateUserDto) {
    return this.setup.createUser(user, dto);
  }

  @Patch('users/:id')
  @RequirePermission('users.manage')
  updateUser(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.setup.updateUser(user, id, dto);
  }

  @Get('services')
  @RequirePermission('users.manage')
  services(@CurrentUser() user: AuthUser) {
    return this.setup.listServices(user);
  }

  @Post('services')
  @RequirePermission('users.manage')
  createService(@CurrentUser() user: AuthUser, @Body() dto: CreateServiceDto) {
    return this.setup.createService(user, dto);
  }

  @Patch('services/:id')
  @RequirePermission('users.manage')
  updateService(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateServiceDto) {
    return this.setup.updateService(user, id, dto);
  }
}
