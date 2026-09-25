import {
	CategoryRepository,
	createdProductWireSchema,
	CustomError,
	newProductSchema,
	parseRequest,
	ProductRepository,
	Route,
	sendData,
	validationDetailsWireSchema,
} from "#lib";

export default new Route({
	description: "New product creation",
	auth: {
		POST: { required: true, roles: ["ADMIN"] },
	},
	contracts: {
		POST: {
			summary: "Create a Product",
			tags: ["Catalogue"],
			requestBody: {
				description: "The Product to create",
				required: true,
				schema: newProductSchema,
				componentName: "NewProduct",
			},
			responses: {
				201: { description: "Product created", data: createdProductWireSchema },
				400: {
					description: "Invalid Product data or unknown Category",
					errors: [{ code: "VALIDATION_FAILED", details: validationDetailsWireSchema }],
				},
			},
		},
	},
	POST: async ({ body, res, db }) => {
		const data = parseRequest(newProductSchema, body);
		const categoryRepo = new CategoryRepository(db);
		const productRepo = new ProductRepository(db);

		if (!(await categoryRepo.exists(data.category_id)))
			throw new CustomError(400, `category_id '${data.category_id}' doesn't exist.`);

		const product = await productRepo.create(data);
		sendData(res, product, { status: 201 });
	},
});
