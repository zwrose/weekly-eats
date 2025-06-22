import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getMongoClient } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const { name, singularName, pluralName, unit } = body;

    // Validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const client = await getMongoClient();
    const db = client.db();
    const foodItemsCollection = db.collection('foodItems');

    // Check if food item exists and user has permission to edit
    const existingItem = await foodItemsCollection.findOne({ _id: new ObjectId(id) });
    if (!existingItem) {
      return NextResponse.json({ error: 'Food item not found' }, { status: 404 });
    }

    const isAdmin = (session.user as { isAdmin?: boolean })?.isAdmin;
    const isOwner = existingItem.createdBy === session.user.id;

    // Check permissions
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Non-admins can only edit their own personal items
    if (!isAdmin && existingItem.isGlobal) {
      return NextResponse.json({ error: 'Only admins can edit global items' }, { status: 403 });
    }

    const updateData = {
      name: name.trim(),
      singularName: singularName?.trim() || name.trim(),
      pluralName: pluralName?.trim() || name.trim(),
      unit: unit?.trim() || null,
      updatedAt: new Date()
    };

    const result = await foodItemsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Food item not found' }, { status: 404 });
    }

    const updatedItem = await foodItemsCollection.findOne({ _id: new ObjectId(id) });
    return NextResponse.json(updatedItem);
  } catch (error) {
    console.error('Error updating food item:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    const client = await getMongoClient();
    const db = client.db();
    const foodItemsCollection = db.collection('foodItems');

    // Check if food item exists
    const existingItem = await foodItemsCollection.findOne({ _id: new ObjectId(id) });
    if (!existingItem) {
      return NextResponse.json({ error: 'Food item not found' }, { status: 404 });
    }

    const isAdmin = (session.user as { isAdmin?: boolean })?.isAdmin;
    const isOwner = existingItem.createdBy === session.user.id;

    // Check permissions
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Non-admins can only delete their own personal items
    if (!isAdmin && existingItem.isGlobal) {
      return NextResponse.json({ error: 'Only admins can delete global items' }, { status: 403 });
    }

    const result = await foodItemsCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Food item not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Food item deleted successfully' });
  } catch (error) {
    console.error('Error deleting food item:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 