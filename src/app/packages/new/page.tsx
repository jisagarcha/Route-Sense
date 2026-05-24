import { PackageCreationFormV2 } from '@/components/packages/package-creation-form-v2';

export default function NewPackagePage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Create New Package</h1>
        <p className="text-gray-600 mb-8">
          Select products, enter delivery details, and get AI-powered driver recommendations
        </p>
        <PackageCreationFormV2 />
      </div>
    </div>
  );
}
