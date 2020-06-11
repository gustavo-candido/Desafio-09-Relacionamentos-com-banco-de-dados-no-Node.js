import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('User not found', 400);
    }

    const productsIds = products.map(product => ({
      id: product.id,
    }));

    const foundProducts = await this.productsRepository.findAllById(
      productsIds,
    );

    if (foundProducts.length !== products.length) {
      throw new AppError('Cannot create a order with invalid products', 400);
    }

    const updatedItemsStock = foundProducts.map(product => {
      const { id, quantity } = product;

      const orderProduct = products.find(
        requestProduct => requestProduct.id === product.id,
      );

      return {
        id,
        quantity: quantity - (orderProduct ? orderProduct.quantity : quantity),
      };
    });

    const insuficientProductQuantity = updatedItemsStock.some(
      product => product.quantity < 0,
    );

    if (insuficientProductQuantity) {
      throw new AppError('There is no enought quantity for some items', 400);
    }

    await this.productsRepository.updateQuantity(updatedItemsStock);

    const orderProducts = foundProducts.map(product => {
      const { price, id } = product;

      const orderProduct = products.find(
        requestProduct => requestProduct.id === id,
      );

      return {
        product_id: id,
        price,
        quantity: orderProduct ? orderProduct.quantity : 0,
      };
    });

    const order = await this.ordersRepository.create({
      customer,
      products: orderProducts,
    });

    return order;
  }
}

export default CreateOrderService;
