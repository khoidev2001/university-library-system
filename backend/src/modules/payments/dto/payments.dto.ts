import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
} from 'class-validator';
import { IsEntityId } from '../../../common/dto/entity-id.decorator';

export class CreatePaymentDto {
  @ApiPropertyOptional({
    type: [Number],
    description:
      'Các khoản phạt muốn trả; bỏ trống = tất cả khoản phạt chưa trả của chính mình. Số tiền luôn tính lại ở máy chủ.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsEntityId({ each: true })
  fineIds?: number[];
}
