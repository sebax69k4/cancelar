import { Email, PasswordIngreso } from '../../common/validators';

export class LoginDto {
  @Email()
  email: string;

  @PasswordIngreso()
  password: string;
}
