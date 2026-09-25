import {
	categoryWireSchema,
	CategoryRepository,
	newCategorySchema,
	parseRequest,
	Route,
	sendData,
	validationDetailsWireSchema,
} from "#lib";

export default new Route({
	description: "Create new category",
	auth: { POST: { required: true, roles: ["ADMIN"] } },
	contracts: {
		POST: {
			summary: "Create a Category",
			tags: ["Catalogue"],
			requestBody: {
				description: "The Category to create",
				required: true,
				schema: newCategorySchema,
				componentName: "NewCategory",
			},
			responses: {
				201: { description: "Category created", data: categoryWireSchema },
				400: {
					description: "Invalid Category data",
					errors: [{ code: "VALIDATION_FAILED", details: validationDetailsWireSchema }],
				},
				409: { description: "Category name already exists", errors: [{ code: "CONFLICT" }] },
			},
		},
	},
	POST: async ({ res, db, body }) => {
		const categoryRepo = new CategoryRepository(db);
		const data = parseRequest(newCategorySchema, body);

		const category = await categoryRepo.create(data);
		sendData(res, category, { status: 201 });
	},
});
